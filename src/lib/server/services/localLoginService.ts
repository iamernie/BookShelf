import crypto from 'crypto';
import { redirect, type Cookies } from '@sveltejs/kit';
import { and, eq, ne, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db, settings, oidcProviders, userOidcLinks, users } from '$lib/server/db';
import { DEFAULT_SETTINGS, getSetting } from './settingsService';
import { createLogger } from './loggerService';
import { getClientIP, loginLimiter } from '$lib/server/middleware/rateLimiter';
import { shouldUseSecureCookies } from '$lib/server/utils/cookies';

/**
 * Turning off password sign-in (2.34.0, card #120), with an emergency bypass URL.
 *
 * - auth.disable_local_login ('true' = off). Code default 'false'; no row is written until an admin
 *   uses the panel. With it 'false' nothing here changes any behavior except that a /login URL
 *   carrying t= is redirected to a bare /login, so a secret never sits in a rendered page's URL.
 * - auth.local_login_bypass_secret: 32 random bytes, base64url. Written together with the switch in
 *   one synchronous transaction, kept when the switch goes back off, replaced only by Rotate.
 * - /login?local=1&t=<secret> sets a grant cookie <expMs>.<base64url(HMAC-SHA256(secret, ...))>,
 *   valid 15 minutes and keyed by the CURRENT secret, so rotating ends every open window.
 * The secret is never a log field and never leaves the server except in the admin-only, no-store
 * GET /api/admin/auth/local-login response.
 */

export const LOCAL_LOGIN_DISABLED_KEY = 'auth.disable_local_login' as const;
export const BYPASS_SECRET_KEY = 'auth.local_login_bypass_secret' as const;
export const BYPASS_LAST_USED_KEY = 'auth.local_login_bypass_last_used_at' as const;
export const BYPASS_COOKIE = 'local_login_bypass';
export const GRANT_TTL_MS = 15 * 60 * 1000;
const GRANT_CONTEXT = 'bookshelf-local-bypass-v1';

const log = createLogger('local-login');

type ManagedKey = typeof LOCAL_LOGIN_DISABLED_KEY | typeof BYPASS_SECRET_KEY | typeof BYPASS_LAST_USED_KEY;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------- primitives ----------

const digest = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest();

/** Constant-time string compare: both sides hashed to 32 bytes first, so length doesn't leak */
function safeEqual(a: string, b: string): boolean {
	return crypto.timingSafeEqual(digest(a), digest(b));
}

export function generateBypassSecret(): string {
	return crypto.randomBytes(32).toString('base64url');
}

/** Does t match the stored secret? An empty stored secret matches nothing */
export function checkBypassToken(t: string | null | undefined, stored: string): boolean {
	if (!stored || !t) return false;
	return safeEqual(t, stored);
}

function grantMac(secret: string, exp: string): string {
	return crypto.createHmac('sha256', secret).update(`${GRANT_CONTEXT}|${exp}`).digest('base64url');
}

export function mintGrant(secret: string, now: number = Date.now()): string {
	const exp = String(now + GRANT_TTL_MS);
	return `${exp}.${grantMac(secret, exp)}`;
}

/** A grant is valid when well-formed, unexpired, no further out than the TTL, and keyed by the current secret */
export function verifyGrant(value: string | undefined | null, secret: string, now: number = Date.now()): boolean {
	try {
		if (!value || !secret) return false;
		const m = /^(\d{1,16})\.([A-Za-z0-9_-]{43})$/.exec(value);
		if (!m) return false;
		const expMs = Number(m[1]);
		if (!(now < expMs && expMs <= now + GRANT_TTL_MS)) return false;
		return safeEqual(m[2], grantMac(secret, m[1]));
	} catch {
		return false;
	}
}

function writeRow(tx: Tx | typeof db, key: ManagedKey, value: string): void {
	const meta = DEFAULT_SETTINGS[key];
	const now = new Date().toISOString();
	tx.insert(settings)
		.values({ key, value, type: meta.type, category: meta.category, label: meta.label, description: meta.description, isSystem: true, createdAt: now, updatedAt: now })
		.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
		.run();
}

function readRow(tx: Tx | typeof db, key: ManagedKey): string {
	const row = tx.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get();
	return row?.value ?? DEFAULT_SETTINGS[key].value;
}

const userAgentOf = (request: Request) => (request.headers.get('user-agent') ?? '').slice(0, 200);

// ---------- state ----------

export async function isLocalLoginDisabled(): Promise<boolean> {
	return (await getSetting(LOCAL_LOGIN_DISABLED_KEY)) === 'true';
}

export function countEnabledProviders(): number {
	const row = db.select({ n: sql<number>`COUNT(*)` }).from(oidcProviders).where(eq(oidcProviders.enabled, true)).get();
	return Number(row?.n ?? 0);
}

/** Does this user hold a link to a provider that is currently enabled? */
export function hasEnabledSsoLink(userId: number): boolean {
	const row = db
		.select({ id: userOidcLinks.id })
		.from(userOidcLinks)
		.innerJoin(oidcProviders, eq(oidcProviders.id, userOidcLinks.providerId))
		.where(and(eq(userOidcLinks.userId, userId), eq(oidcProviders.enabled, true)))
		.limit(1)
		.get();
	return !!row;
}

/** Switch on but no secret: only possible by hand-editing the database or restoring an odd backup */
export async function bypassNeedsRepair(): Promise<boolean> {
	return (await isLocalLoginDisabled()) && !(await getSetting(BYPASS_SECRET_KEY));
}

export interface LocalLoginAdminState {
	disabled: boolean;
	secretSet: boolean;
	needsRepair: boolean;
	lastUsedAt: string | null;
	enabledProviderCount: number;
	actingAdminLinked: boolean;
	unlinkedUsers: { username: string }[];
	allowSignup: boolean;
}

/** Everything the admin panel shows. Never the secret. */
export async function getLocalLoginAdminState(actingUserId: number): Promise<LocalLoginAdminState> {
	const disabled = await isLocalLoginDisabled();
	const secretSet = !!(await getSetting(BYPASS_SECRET_KEY));
	const lastUsed = await getSetting(BYPASS_LAST_USED_KEY);
	const unlinkedUsers = db
		.select({ username: users.username })
		.from(users)
		.where(sql`NOT EXISTS (SELECT 1 FROM user_oidc_links l JOIN oidc_providers p ON p.id = l.providerId WHERE l.userId = ${users.id} AND p.enabled = 1)`)
		.orderBy(users.username)
		.all();
	if (disabled && !secretSet) {
		log.error('Password sign-in is off but no emergency sign-in URL exists. Use Rotate URL on the single sign-on settings page to create one.');
	}
	return {
		disabled,
		secretSet,
		needsRepair: disabled && !secretSet,
		lastUsedAt: lastUsed || null,
		enabledProviderCount: countEnabledProviders(),
		actingAdminLinked: hasEnabledSsoLink(actingUserId),
		unlinkedUsers,
		allowSignup: (await getSetting('registration.allow_signup')) === 'true'
	};
}

// ---------- admin actions ----------

export type SwitchResult =
	| { ok: true; disabled: boolean; secretGenerated: boolean }
	| { ok: false; code: 'no_sso_provider' | 'admin_not_linked'; message: string };

export async function setLocalLoginDisabled(disabled: boolean, actor: { id: number }): Promise<SwitchResult> {
	if (!disabled) {
		writeRow(db, LOCAL_LOGIN_DISABLED_KEY, 'false');
		log.info('Password sign-in turned on', { actorId: actor.id });
		return { ok: true, disabled: false, secretGenerated: false };
	}
	if (countEnabledProviders() === 0) {
		return { ok: false, code: 'no_sso_provider', message: 'Add and enable a single sign-on provider before turning off password sign-in.' };
	}
	if (!hasEnabledSsoLink(actor.id)) {
		return { ok: false, code: 'admin_not_linked', message: 'Link your own account to a single sign-on provider before turning off password sign-in, or you could lock yourself out.' };
	}
	// One synchronous transaction: the switch is never on without a secret
	const secretGenerated = db.transaction((tx) => {
		const generated = !readRow(tx, BYPASS_SECRET_KEY);
		if (generated) writeRow(tx, BYPASS_SECRET_KEY, generateBypassSecret());
		writeRow(tx, LOCAL_LOGIN_DISABLED_KEY, 'true');
		return generated;
	});
	log.info('Password sign-in turned off', { actorId: actor.id });
	if (secretGenerated) log.info('Emergency sign-in URL generated', { actorId: actor.id });
	return { ok: true, disabled: true, secretGenerated };
}

/** Replace the secret (allowed in either state, and the repair path when the switch is on with none) */
export function rotateBypassSecret(actor: { id: number }): void {
	const hadSecret = db.transaction((tx) => {
		const had = !!readRow(tx, BYPASS_SECRET_KEY);
		writeRow(tx, BYPASS_SECRET_KEY, generateBypassSecret());
		return had;
	});
	log.info(hadSecret ? 'Emergency sign-in URL rotated' : 'Emergency sign-in URL generated', { actorId: actor.id });
}

/** The full emergency URL, for the admin-only no-store endpoint. Null when no secret exists yet. */
export async function getBypassUrl(requestOrigin: string): Promise<string | null> {
	const secret = await getSetting(BYPASS_SECRET_KEY);
	if (!secret) return null;
	const origin = (env.ORIGIN?.trim() || requestOrigin).replace(/\/+$/, '');
	return `${origin}/login?local=1&t=${secret}`;
}

// ---------- the /login page ----------

export interface LoginPageAccess {
	disabled: boolean;
	formVisible: boolean;
	emergency: boolean;
}

/**
 * Called from the /login load (after the signed-in redirect). A URL carrying t= always ends in a
 * 303: to /login?local=1 with a grant cookie when the switch is on and t matches, else to a bare
 * /login (switch off: no compare, no cookie, no log). Otherwise reports what the page shows.
 */
export async function resolveLoginPageAccess(url: URL, cookies: Cookies, request: Request): Promise<LoginPageAccess> {
	if (url.searchParams.has('t')) {
		let disabled = false;
		try {
			disabled = await isLocalLoginDisabled();
		} catch (e) {
			log.error('Emergency sign-in check failed', { error: e instanceof Error ? e.message : String(e) });
		}
		if (!disabled) throw redirect(303, '/login');

		const ip = getClientIP(request);
		const limit = loginLimiter.check(request, 'local-bypass');
		if (!limit.allowed) {
			log.warn('Emergency sign-in URL refused', { ip, reason: 'rate_limited' });
			throw redirect(303, '/login');
		}

		let secret = '';
		try {
			secret = await getSetting(BYPASS_SECRET_KEY);
		} catch (e) {
			log.error('Emergency sign-in check failed', { error: e instanceof Error ? e.message : String(e) });
		}
		const ok = url.searchParams.get('local') === '1' && checkBypassToken(url.searchParams.get('t'), secret);
		if (!ok) {
			log.warn('Emergency sign-in URL refused', { ip, reason: 'bad_token' });
			throw redirect(303, '/login');
		}

		cookies.set(BYPASS_COOKIE, mintGrant(secret), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: shouldUseSecureCookies(),
			maxAge: GRANT_TTL_MS / 1000
		});
		try {
			writeRow(db, BYPASS_LAST_USED_KEY, new Date().toISOString());
		} catch (e) {
			log.error('Could not record emergency sign-in use', { error: e instanceof Error ? e.message : String(e) });
		}
		log.warn('Emergency sign-in URL used', { ip, userAgent: userAgentOf(request) });
		// Takes the secret out of the address bar
		throw redirect(303, '/login?local=1');
	}

	const disabled = await isLocalLoginDisabled();
	if (!disabled) return { disabled: false, formVisible: true, emergency: false };
	const emergency = verifyGrant(cookies.get(BYPASS_COOKIE), await getSetting(BYPASS_SECRET_KEY));
	return { disabled: true, formVisible: emergency, emergency };
}

// ---------- POST /api/auth/login ----------

export type LocalLoginGate =
	| { allowed: true; viaBypass: boolean }
	| { allowed: false; reason: 'disabled' | 'check_failed' };

/** The password login gate. Fails closed: any internal error refuses. */
export async function checkLocalLoginGate(cookies: Cookies, request: Request): Promise<LocalLoginGate> {
	try {
		if (!(await isLocalLoginDisabled())) return { allowed: true, viaBypass: false };
		const grant = cookies.get(BYPASS_COOKIE);
		if (grant && verifyGrant(grant, await getSetting(BYPASS_SECRET_KEY))) return { allowed: true, viaBypass: true };
		if (grant) {
			log.warn('Password sign-in refused: emergency sign-in window expired or invalid', { ip: getClientIP(request) });
		} else {
			log.debug('Password sign-in refused: password sign-in is off', { ip: getClientIP(request) });
		}
		return { allowed: false, reason: 'disabled' };
	} catch (e) {
		log.error('Password sign-in check failed; refusing the sign-in', { error: e instanceof Error ? e.message : String(e) });
		return { allowed: false, reason: 'check_failed' };
	}
}

export function recordBypassLogin(user: { id: number; username: string }, request: Request): void {
	log.warn('Emergency sign-in: password login', { userId: user.id, username: user.username, ip: getClientIP(request) });
}

// ---------- rails while the switch is on ----------

/**
 * Refuse deleting or disabling the last enabled provider while password sign-in is off (F3).
 * Returns a refusal message, or null when allowed.
 */
export async function lastProviderRefusal(providerId: number): Promise<string | null> {
	if (!(await isLocalLoginDisabled())) return null;
	const remaining = db
		.select({ n: sql<number>`COUNT(*)` })
		.from(oidcProviders)
		.where(and(eq(oidcProviders.enabled, true), ne(oidcProviders.id, providerId)))
		.get();
	const target = db.select({ enabled: oidcProviders.enabled }).from(oidcProviders).where(eq(oidcProviders.id, providerId)).get();
	if (!target?.enabled || Number(remaining?.n ?? 0) > 0) return null;
	return 'This is the last enabled single sign-on provider and password sign-in is off. Turn password sign-in back on first.';
}

/** Refuse removing a user's last SSO link while password sign-in is off (D9). Null when allowed. */
export async function lastLinkRefusal(userId: number, providerId: number): Promise<string | null> {
	if (!(await isLocalLoginDisabled())) return null;
	const target = db
		.select({ id: userOidcLinks.id })
		.from(userOidcLinks)
		.where(and(eq(userOidcLinks.userId, userId), eq(userOidcLinks.providerId, providerId)))
		.get();
	if (!target) return null;
	const others = db
		.select({ n: sql<number>`COUNT(*)` })
		.from(userOidcLinks)
		.where(and(eq(userOidcLinks.userId, userId), ne(userOidcLinks.providerId, providerId)))
		.get();
	if (Number(others?.n ?? 0) > 0) return null;
	return "This is your only single sign-on link and password sign-in is off, so you couldn't sign in again. Link another provider first, or ask an administrator.";
}
