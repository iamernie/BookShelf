/**
 * Audiobookshelf connections per BookShelf user (2.36.0, card 134)
 *
 * Each user may connect their own ABS account by pasting an ABS API key (or an admin assigns one).
 * The key is checked against the ADMIN-CONFIGURED server only (integration.abs_base_url; no route
 * takes a URL), its GET /api/me id becomes absUserId (unique: one BookShelf user per ABS user), and
 * it is stored sealed (secretBox), never returned, never logged (fingerprint only).
 *
 * The sync owner's pre-2.36 status sync arrives as a 'site' row reusing integration.abs_api_key
 * (migrateAbsSiteConnection in db/index.ts); it starts with absUserId NULL until a run resolves it.
 *
 * Watermarks (abs_member_item_state) mark what is history: at connect every current progress record
 * is stored at its lastUpdate and baselineAt is the newest of them (or ABS's Date header), both on
 * the ABS clock. Any change of ABS identity resets them in the same transaction (B1), so another
 * person's history never reads as new listening.
 *
 * Member keys only ever call GET /api/me, /api/me/progress/:id and /api/me/listening-sessions.
 */

import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { absMemberItemState, absSyncMemberRuns, absSyncRuns, absUserConnections, users, type AbsUserConnection } from '$lib/server/db/schema';
import { AbsHttpError, describeError, getAbsConfig, type AbsConfig, type AbsMediaProgress } from './absService';
import { getSetting, getSettingAs, ABS_SYNC_INTERVALS } from './settingsService';
import { openSecret, sealSecret, secretBoxRefusal, secretFingerprint, SecretBoxUnavailable } from './secretBox';
import { createLogger } from './loggerService';

const log = createLogger('abs-connect');

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_KEY_LENGTH = 4096;
const SITE_IDENTITY_TTL_MS = 60_000;

// ============================================
// Member-key ABS client (allow-listed paths only)
// ============================================

const MEMBER_PATHS = [/^\/api\/me$/, /^\/api\/me\/progress\/[^/?]+$/, /^\/api\/me\/listening-sessions(\?.*)?$/];

export interface AbsMe {
	id: string;
	username: string | null;
	type: string | null;
	progress: AbsMediaProgress[];
	/** ABS's own clock (Date response header), epoch ms; null when absent */
	serverDateMs: number | null;
}

/**
 * GET with a per-user key. Only the allow-listed /api/me paths; never follows a redirect (the key
 * must not be replayed to another host). Throws AbsHttpError on non-2xx, plain fetch errors otherwise.
 */
export async function absUserGet<T>(baseUrl: string, apiKey: string, path: string): Promise<{ body: T; serverDateMs: number | null }> {
	if (!MEMBER_PATHS.some((re) => re.test(path))) throw new Error(`Refused Audiobookshelf path for a user key: ${path.split('?')[0]}`);
	const res = await fetch(`${baseUrl}${path}`, {
		headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
		redirect: 'error',
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});
	if (!res.ok) {
		await res.body?.cancel();
		const reason = res.status === 401 || res.status === 403 ? 'API key rejected' : res.statusText;
		throw new AbsHttpError(`Audiobookshelf returned ${res.status}${reason ? ` (${reason})` : ''} for ${path.split('?')[0]}`, res.status);
	}
	const date = Date.parse(res.headers.get('date') ?? '');
	return { body: (await res.json()) as T, serverDateMs: Number.isNaN(date) ? null : date };
}

/** GET /api/me, reduced to what we keep. The raw body (older builds carry a token) is never stored or logged. */
export async function fetchAbsMe(baseUrl: string, apiKey: string): Promise<AbsMe> {
	const { body, serverDateMs } = await absUserGet<{ id?: unknown; username?: unknown; type?: unknown; mediaProgress?: AbsMediaProgress[] }>(baseUrl, apiKey, '/api/me');
	if (typeof body?.id !== 'string' || !body.id) throw new Error('Audiobookshelf did not say who this key belongs to');
	return {
		id: body.id,
		username: typeof body.username === 'string' ? body.username : null,
		type: typeof body.type === 'string' ? body.type : null,
		progress: Array.isArray(body.mediaProgress) ? body.mediaProgress : [],
		serverDateMs
	};
}

/** Book progress records only (podcast episodes skipped) */
export function bookProgress(progress: AbsMediaProgress[]): AbsMediaProgress[] {
	return progress.filter((p) => !!p && typeof p.libraryItemId === 'string' && p.libraryItemId && !p.episodeId);
}

const hasTimestamp = (p: AbsMediaProgress): p is AbsMediaProgress & { lastUpdate: number } =>
	typeof p.lastUpdate === 'number' && Number.isFinite(p.lastUpdate) && p.lastUpdate > 0;

/** Baseline on the ABS clock: the newest seeded lastUpdate, else the Date header. Never BookShelf's clock. */
export function baselineFrom(me: Pick<AbsMe, 'progress' | 'serverDateMs'>): number | null {
	const stamps = bookProgress(me.progress).filter(hasTimestamp).map((p) => p.lastUpdate);
	if (stamps.length > 0) return Math.max(...stamps);
	return me.serverDateMs;
}

// ============================================
// Site identity (cached; S14)
// ============================================

const siteCache = new Map<string, { at: number; promise: Promise<string | null> }>();

/** The ABS user id behind integration.abs_api_key right now (cached 60 s); null when it can't be told. */
export async function getSiteAbsUserId(config?: AbsConfig): Promise<string | null> {
	const c = config ?? (await getAbsConfig());
	if (!c.baseUrl || !c.apiKey) return null;
	const key = `${c.baseUrl}|${secretFingerprint(c.apiKey)}`;
	const hit = siteCache.get(key);
	if (hit && Date.now() - hit.at < SITE_IDENTITY_TTL_MS) return hit.promise;
	const promise = fetchAbsMe(c.baseUrl, c.apiKey).then((me) => me.id, () => null);
	siteCache.set(key, { at: Date.now(), promise });
	const id = await promise;
	if (id === null) siteCache.delete(key); // don't cache a failure
	return id;
}

export function clearSiteIdentityCache(): void {
	siteCache.clear();
}

// ============================================
// Keys for a connection
// ============================================

export type KeyResolution = { ok: true; apiKey: string } | { ok: false; error: 'decrypt_failed' | 'no_site_key' };

/** The key to call ABS with for this connection: the sealed own key, or the site key for 'site'. */
export function connectionKey(conn: Pick<AbsUserConnection, 'keySource' | 'keyCiphertext' | 'userId'>, config: AbsConfig): KeyResolution {
	if (conn.keySource === 'site') return config.apiKey ? { ok: true, apiKey: config.apiKey } : { ok: false, error: 'no_site_key' };
	try {
		return { ok: true, apiKey: openSecret(conn.keyCiphertext ?? '') };
	} catch (err) {
		log.warn('Could not open a stored Audiobookshelf key', { userId: conn.userId, reason: err instanceof SecretBoxUnavailable ? err.reason : 'decrypt' });
		return { ok: false, error: 'decrypt_failed' };
	}
}

/**
 * Key + identity check for read paths (heatmap, progress): the viewer's own connection, and for a
 * 'site' row only while the site key still belongs to the bound ABS user (S14). null = not available.
 */
export async function readableConnection(userId: number): Promise<{ conn: AbsUserConnection; config: AbsConfig; apiKey: string } | null> {
	const config = await getAbsConfig();
	if (!config.enabled || !config.baseUrl) return null;
	const [conn] = await db.select().from(absUserConnections).where(eq(absUserConnections.userId, userId)).limit(1);
	if (!conn || !conn.absUserId) return null;
	if (conn.lastError === 'identity_changed' || conn.lastError === 'identity_conflict') return null;
	const key = connectionKey(conn, config);
	if (!key.ok) return null;
	if (conn.keySource === 'site' && (await getSiteAbsUserId(config)) !== conn.absUserId) return null;
	return { conn, config, apiKey: key.apiKey };
}

// ============================================
// Import / connect mutex (S5) and run check
// ============================================

const MUTEX_KEY = Symbol.for('bookshelf.absMemberMutex');
type MutexGlobal = typeof globalThis & { [MUTEX_KEY]?: { holder: string | null } };

function mutex(): { holder: string | null } {
	const g = globalThis as MutexGlobal;
	g[MUTEX_KEY] ??= { holder: null };
	return g[MUTEX_KEY];
}

/** Held while a member's history import writes; the scheduler and Sync Now refuse to start meanwhile. */
export function memberWorkHolder(): string | null {
	return mutex().holder;
}

export function tryHoldMemberWork(holder: string): boolean {
	const m = mutex();
	if (m.holder !== null) return false;
	m.holder = holder;
	return true;
}

export function releaseMemberWork(holder: string): void {
	const m = mutex();
	if (m.holder === holder) m.holder = null;
}

/** A sync run row is 'running' (this or another process). */
export async function isSyncRunning(): Promise<boolean> {
	const [row] = await db.select({ id: absSyncRuns.id }).from(absSyncRuns).where(eq(absSyncRuns.status, 'running')).limit(1);
	return !!row;
}

// ============================================
// Views
// ============================================

export interface ConnectionView {
	connected: boolean;
	absUsername: string | null;
	keySource: 'own' | 'site' | null;
	keyFingerprint: string | null;
	syncListening: boolean;
	pending: boolean;
	connectedAt: string | null;
	connectedByOther: boolean;
	lastSyncAt: string | null;
	lastError: string | null;
	lastErrorAt: string | null;
}

const EMPTY_VIEW: ConnectionView = {
	connected: false, absUsername: null, keySource: null, keyFingerprint: null, syncListening: false, pending: false,
	connectedAt: null, connectedByOther: false, lastSyncAt: null, lastError: null, lastErrorAt: null
};

export function toConnectionView(conn: AbsUserConnection | null | undefined): ConnectionView {
	if (!conn) return { ...EMPTY_VIEW };
	return {
		connected: true,
		absUsername: conn.absUsername,
		keySource: conn.keySource === 'site' ? 'site' : 'own',
		keyFingerprint: conn.keySource === 'own' ? conn.keyFingerprint : null,
		syncListening: conn.syncListening === 1,
		pending: conn.absUserId === null,
		connectedAt: conn.connectedAt,
		connectedByOther: conn.connectedBy !== null && conn.connectedBy !== conn.userId,
		lastSyncAt: conn.lastSyncAt,
		lastError: conn.lastError,
		lastErrorAt: conn.lastErrorAt
	};
}

export async function getConnection(userId: number): Promise<AbsUserConnection | null> {
	const [conn] = await db.select().from(absUserConnections).where(eq(absUserConnections.userId, userId)).limit(1);
	return conn ?? null;
}

export interface SyncCadence {
	/** Site sync on, a valid owner and an interval: member sync runs with each scheduled site sync */
	scheduled: boolean;
	intervalMinutes: number;
}

/** Member listening only syncs inside site runs (N5): enabled + sync on + owner + interval > 0. */
export async function getSyncCadence(): Promise<SyncCadence> {
	const [config, syncEnabled, ownerRaw, minutes] = await Promise.all([
		getAbsConfig(),
		getSettingAs<boolean>('integration.abs_sync_enabled', 'boolean'),
		getSetting('integration.abs_owner_user_id'),
		getSettingAs<number>('integration.abs_sync_interval_minutes', 'number')
	]);
	const intervalMinutes = (ABS_SYNC_INTERVALS as readonly number[]).includes(minutes) ? minutes : 360;
	const ownerId = parseInt(ownerRaw.trim(), 10);
	let ownerOk = false;
	if (Number.isInteger(ownerId) && ownerId > 0) {
		const [o] = await db.select({ role: users.role }).from(users).where(eq(users.id, ownerId)).limit(1);
		ownerOk = o?.role === 'admin' || o?.role === 'librarian';
	}
	return { scheduled: config.enabled && !!config.baseUrl && !!config.apiKey && syncEnabled && ownerOk && intervalMinutes > 0, intervalMinutes };
}

/** Listened items that couldn't be placed, from the member's latest run (unlinked + notReachable merged, S12). */
export async function getUnplacedCount(userId: number): Promise<number> {
	const [row] = await db.select({ unlinked: absSyncMemberRuns.unlinked, notReachable: absSyncMemberRuns.notReachable })
		.from(absSyncMemberRuns)
		.innerJoin(absSyncRuns, eq(absSyncRuns.id, absSyncMemberRuns.runId))
		.where(and(eq(absSyncMemberRuns.userId, userId), ne(absSyncMemberRuns.status, 'skipped'), eq(absSyncRuns.mode, 'apply')))
		.orderBy(desc(absSyncMemberRuns.id))
		.limit(1);
	return row ? row.unlinked + row.notReachable : 0;
}

export interface MemberRow {
	userId: number;
	username: string;
	role: string | null;
	connection: ConnectionView;
	connectedByName: string | null;
}

/** Admin Members panel: every non-guest user with their connection state. Never a key. */
export async function listMemberConnections(): Promise<MemberRow[]> {
	const rows = await db.select({ user: { id: users.id, username: users.username, role: users.role }, conn: absUserConnections })
		.from(users)
		.leftJoin(absUserConnections, eq(absUserConnections.userId, users.id))
		.where(sql`COALESCE(${users.role}, 'member') != 'guest'`)
		.orderBy(asc(users.username));
	const names = new Map((await db.select({ id: users.id, username: users.username }).from(users)).map((u) => [u.id, u.username]));
	return rows.map((r) => ({
		userId: r.user.id,
		username: r.user.username,
		role: r.user.role,
		connection: toConnectionView(r.conn),
		connectedByName: r.conn?.connectedBy != null ? names.get(r.conn.connectedBy) ?? null : null
	}));
}

// ============================================
// Connect / rebind / disconnect
// ============================================

export type ConnectFailure = { ok: false; status: 400 | 404 | 409 | 502 | 503; code: string; message: string };
export type ConnectResult = { ok: true; connection: ConnectionView } | ConnectFailure;

const fail = (status: ConnectFailure['status'], code: string, message: string): ConnectFailure => ({ ok: false, status, code, message });

const TAKEN = fail(409, 'abs_user_taken', 'This Audiobookshelf account is already connected to another BookShelf user');
const RUNNING = fail(409, 'sync_running', 'An Audiobookshelf sync is running. Try again in a minute.');

// drizzle wraps driver errors; the SQLite reason is on the cause
function isUniqueViolation(err: unknown): boolean {
	for (let e: unknown = err; e instanceof Error; e = (e as Error & { cause?: unknown }).cause) {
		if ((e as Error & { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint/i.test(e.message)) return true;
	}
	return false;
}

function validKey(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const k = raw.trim();
	if (!k || k.length > MAX_KEY_LENGTH || /[\s\x00-\x1f\x7f]/.test(k)) return null;
	return k;
}

/** The ABS account a key belongs to may sync for this BookShelf user (blast-radius cap, S11). */
function typeAllowed(absType: string | null, targetRole: string | null): boolean {
	const powerful = absType === 'root' || absType === 'admin';
	return !powerful || targetRole === 'admin';
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Replace the user's watermarks with the given progress (one transaction with the identity write). */
function reseedWatermarks(tx: Tx, userId: number, progress: AbsMediaProgress[]): number {
	tx.delete(absMemberItemState).where(eq(absMemberItemState.userId, userId)).run();
	const now = new Date().toISOString();
	let seeded = 0;
	for (const p of bookProgress(progress)) {
		if (!hasTimestamp(p)) continue;
		tx.insert(absMemberItemState)
			.values({ userId, absItemId: p.libraryItemId, lastActedUpdate: p.lastUpdate, lastActedFinished: p.isFinished ? 1 : 0, updatedAt: now })
			.onConflictDoNothing()
			.run();
		seeded++;
	}
	return seeded;
}

interface Bind {
	userId: number;
	me: AbsMe;
	baselineAt: number;
	keySource: 'own' | 'site';
	keyCiphertext: string | null;
	keyFingerprint: string | null;
	/** Acting user: consent resets when someone other than the member binds (B1) */
	actorId: number | null;
	/** Watermarks + baseline reset (a new identity, or an explicit re-bind) */
	reset: boolean;
}

/** Insert or update the row and, on a reset, the watermarks + baseline: one transaction. */
function bindConnection(b: Bind): void {
	const now = new Date().toISOString();
	db.transaction((tx) => {
		const existing = tx.select().from(absUserConnections).where(eq(absUserConnections.userId, b.userId)).get();
		const byOther = b.actorId !== b.userId;
		if (!existing) {
			tx.insert(absUserConnections).values({
				userId: b.userId,
				absUserId: b.me.id,
				absUsername: b.me.username,
				keySource: b.keySource,
				keyCiphertext: b.keyCiphertext,
				keyFingerprint: b.keyFingerprint,
				syncListening: 0,
				baselineAt: b.baselineAt,
				connectedBy: b.actorId,
				connectedAt: now,
				createdAt: now,
				updatedAt: now
			}).run();
			reseedWatermarks(tx, b.userId, b.me.progress);
			return;
		}
		tx.update(absUserConnections).set({
			absUserId: b.me.id,
			absUsername: b.me.username,
			keySource: b.keySource,
			keyCiphertext: b.keyCiphertext,
			keyFingerprint: b.keyFingerprint,
			syncListening: byOther ? 0 : existing.syncListening,
			baselineAt: b.reset || existing.baselineAt === null ? b.baselineAt : existing.baselineAt,
			connectedBy: b.actorId,
			connectedAt: b.reset ? now : existing.connectedAt,
			lastError: null,
			lastErrorAt: null,
			updatedAt: now
		}).where(eq(absUserConnections.id, existing.id)).run();
		if (b.reset) reseedWatermarks(tx, b.userId, b.me.progress);
	});
}

/**
 * Connect (or replace) a user's own ABS key. Self-connect and admin Assign share this; only `apiKey`
 * is read, the server URL is always the stored one. Admin assigns never turn syncing on and reset it
 * to off over an existing row. A different ABS identity than before resets watermarks + baseline.
 */
export async function connectAbsKey(input: { targetUserId: number; actor: { id: number; role: string | null }; apiKey: unknown }): Promise<ConnectResult> {
	const config = await getAbsConfig();
	if (!config.enabled || !config.baseUrl) return fail(503, 'abs_unavailable', 'Audiobookshelf is not set up on this server');
	const refusal = secretBoxRefusal();
	if (refusal) {
		log.warn('Refused to store an Audiobookshelf key: secret storage unavailable', { reason: refusal });
		return fail(503, 'secret_unavailable', 'This server cannot store keys safely yet. Ask your administrator to set SESSION_SECRET.');
	}

	const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.targetUserId)).limit(1);
	if (!target || target.role === 'guest') return fail(404, 'user_not_found', 'User not found');

	const apiKey = validKey(input.apiKey);
	if (!apiKey) return fail(400, 'invalid_key', 'Paste an Audiobookshelf API key');
	if (await isSyncRunning()) return RUNNING;

	let me: AbsMe;
	try {
		me = await fetchAbsMe(config.baseUrl, apiKey);
	} catch (err) {
		if (err instanceof AbsHttpError && (err.status === 401 || err.status === 403)) return fail(400, 'key_rejected', "Audiobookshelf didn't accept that key");
		return fail(502, 'abs_unreachable', `Couldn't reach Audiobookshelf: ${describeError(err)}`);
	}
	if (!typeAllowed(me.type, target.role)) {
		return fail(400, 'key_too_powerful', 'That key belongs to an Audiobookshelf admin account. Use a key for a regular Audiobookshelf user.');
	}

	// The site row's identity counts as taken too, even while it is still pending (S2)
	const [site] = await db.select().from(absUserConnections).where(eq(absUserConnections.keySource, 'site')).limit(1);
	if (site && site.userId !== target.id) {
		const siteId = site.absUserId ?? (config.apiKey ? await getSiteAbsUserId(config) : null);
		if (site.absUserId === null && siteId === null && config.apiKey) {
			return fail(503, 'site_unverified', "Couldn't check the server's own Audiobookshelf account. Try again in a minute.");
		}
		if (siteId === me.id) return TAKEN;
	}
	const [other] = await db.select({ userId: absUserConnections.userId }).from(absUserConnections)
		.where(and(eq(absUserConnections.absUserId, me.id), ne(absUserConnections.userId, target.id))).limit(1);
	if (other) return TAKEN;

	const baselineAt = baselineFrom(me);
	if (baselineAt === null) return fail(502, 'abs_no_clock', "Audiobookshelf didn't send the time; try again");

	const [existing] = await db.select().from(absUserConnections).where(eq(absUserConnections.userId, target.id)).limit(1);
	const reset = !existing || existing.absUserId !== me.id;
	let sealed: string;
	try {
		sealed = sealSecret(apiKey);
	} catch {
		return fail(503, 'secret_unavailable', 'This server cannot store keys safely yet. Ask your administrator to set SESSION_SECRET.');
	}
	const fingerprint = secretFingerprint(apiKey);
	try {
		bindConnection({ userId: target.id, me, baselineAt, keySource: 'own', keyCiphertext: sealed, keyFingerprint: fingerprint, actorId: input.actor.id, reset });
	} catch (err) {
		if (isUniqueViolation(err)) return TAKEN;
		throw err;
	}
	log.info('Audiobookshelf account connected', {
		userId: target.id, actorId: input.actor.id, absUserId: me.id, keyFingerprint: fingerprint, identityChanged: reset, replaced: !!existing
	});
	return { ok: true, connection: toConnectionView(await getConnection(target.id)) };
}

/**
 * Re-bind a 'site' row to whoever the site key belongs to now (an admin action, also what the first
 * run does for a pending row): watermarks + baseline reset in one transaction; consent resets unless
 * the owner does it themselves. 409 when that ABS user is already someone else's.
 */
export async function rebindSiteConnection(targetUserId: number, actor: { id: number } | null): Promise<ConnectResult> {
	const config = await getAbsConfig();
	if (!config.baseUrl || !config.apiKey) return fail(503, 'abs_unavailable', 'Audiobookshelf URL or API key is not set');
	const conn = await getConnection(targetUserId);
	if (!conn || conn.keySource !== 'site') return fail(404, 'not_site', 'This user does not use the site key');
	if (actor && (await isSyncRunning())) return RUNNING;

	let me: AbsMe;
	try {
		me = await fetchAbsMe(config.baseUrl, config.apiKey);
	} catch (err) {
		if (err instanceof AbsHttpError && (err.status === 401 || err.status === 403)) return fail(400, 'key_rejected', 'Audiobookshelf rejected the site API key');
		return fail(502, 'abs_unreachable', `Couldn't reach Audiobookshelf: ${describeError(err)}`);
	}
	const [other] = await db.select({ userId: absUserConnections.userId }).from(absUserConnections)
		.where(and(eq(absUserConnections.absUserId, me.id), ne(absUserConnections.userId, targetUserId))).limit(1);
	if (other) {
		await markError(targetUserId, 'identity_conflict');
		return fail(409, 'identity_conflict', 'The site key belongs to an Audiobookshelf account another user has connected');
	}
	const baselineAt = baselineFrom(me);
	if (baselineAt === null) return fail(502, 'abs_no_clock', "Audiobookshelf didn't send the time; try again");
	try {
		bindConnection({ userId: targetUserId, me, baselineAt, keySource: 'site', keyCiphertext: null, keyFingerprint: null, actorId: actor?.id ?? targetUserId, reset: true });
	} catch (err) {
		if (isUniqueViolation(err)) {
			await markError(targetUserId, 'identity_conflict');
			return fail(409, 'identity_conflict', 'The site key belongs to an Audiobookshelf account another user has connected');
		}
		throw err;
	}
	clearSiteIdentityCache();
	log.info('Audiobookshelf site connection bound', { userId: targetUserId, actorId: actor?.id ?? null, absUserId: me.id });
	return { ok: true, connection: toConnectionView(await getConnection(targetUserId)) };
}

export async function markError(userId: number, error: string | null): Promise<void> {
	const now = new Date().toISOString();
	await db.update(absUserConnections)
		.set({ lastError: error, lastErrorAt: error ? now : null, updatedAt: now })
		.where(eq(absUserConnections.userId, userId));
}

/** The member's consent; only the member flips it (admins never do). */
export async function setSyncListening(userId: number, on: boolean): Promise<ConnectionView | null> {
	const now = new Date().toISOString();
	const res = await db.update(absUserConnections).set({ syncListening: on ? 1 : 0, updatedAt: now }).where(eq(absUserConnections.userId, userId));
	if (res.changes === 0) return null;
	log.info('Audiobookshelf listening sync toggled', { userId, on });
	return toConnectionView(await getConnection(userId));
}

/** Remove the row (ciphertext with it) and the watermarks. Never touches anyone's library. */
export async function disconnectAbs(userId: number): Promise<{ ok: true; removed: boolean } | ConnectFailure> {
	if (await isSyncRunning()) return RUNNING;
	let removed = false;
	db.transaction((tx) => {
		removed = tx.delete(absUserConnections).where(eq(absUserConnections.userId, userId)).run().changes > 0;
		tx.delete(absMemberItemState).where(eq(absMemberItemState.userId, userId)).run();
	});
	if (removed) log.info('Audiobookshelf account disconnected', { userId });
	return { ok: true, removed };
}

/** Logged once at boot when stored keys can't be used (B3). */
export function logSecretBoxStatusAtBoot(): void {
	const refusal = secretBoxRefusal();
	if (refusal) {
		log.warn('Audiobookshelf member keys are disabled: SESSION_SECRET is unusable for key storage', { reason: refusal, minLength: 32 });
	}
}
