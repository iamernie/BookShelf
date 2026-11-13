import { db, oidcProviders, userOidcLinks, users, sessions } from '$lib/server/db';
import { eq, and, sql } from 'drizzle-orm';
import * as client from 'openid-client';
import crypto from 'crypto';
import type { OidcProvider, UserOidcLink } from '$lib/server/db/schema';
import { generateSessionId, hashPassword, verifyPassword, type AuthUser } from './authService';
import { getSetting } from './settingsService';

const SESSION_EXPIRY_DAYS = 7;

// Provider presets for common OIDC providers
export const PROVIDER_PRESETS = {
	google: {
		name: 'Google',
		issuerUrl: 'https://accounts.google.com',
		scopes: ['openid', 'profile', 'email'],
		buttonColor: '#4285f4',
		iconUrl: '/icons/google.svg'
	},
	github: {
		name: 'GitHub',
		issuerUrl: 'https://github.com', // GitHub uses custom OAuth, not standard OIDC
		scopes: ['read:user', 'user:email'],
		buttonColor: '#333333',
		iconUrl: '/icons/github.svg',
		note: 'GitHub uses OAuth 2.0, not standard OIDC'
	},
	authentik: {
		name: 'Authentik',
		issuerUrl: '', // User must provide: https://{domain}/application/o/{app}/
		scopes: ['openid', 'profile', 'email'],
		buttonColor: '#fd4b2d',
		iconUrl: '/icons/authentik.svg'
	},
	keycloak: {
		name: 'Keycloak',
		issuerUrl: '', // User must provide: https://{domain}/realms/{realm}
		scopes: ['openid', 'profile', 'email'],
		buttonColor: '#4d4d4d',
		iconUrl: '/icons/keycloak.svg'
	}
} as const;

export type ProviderPreset = keyof typeof PROVIDER_PRESETS;

// Cache for OIDC configurations (keyed by provider ID)
const configCache = new Map<number, { config: client.Configuration; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ============================================
// Provider Management
// ============================================

export async function getProviders(): Promise<OidcProvider[]> {
	return db.select().from(oidcProviders).orderBy(oidcProviders.displayOrder);
}

export async function getEnabledProviders(): Promise<OidcProvider[]> {
	return db
		.select()
		.from(oidcProviders)
		.where(eq(oidcProviders.enabled, true))
		.orderBy(oidcProviders.displayOrder);
}

export async function getProviderBySlug(slug: string): Promise<OidcProvider | null> {
	const result = await db
		.select()
		.from(oidcProviders)
		.where(eq(oidcProviders.slug, slug))
		.limit(1);
	return result[0] || null;
}

export async function getProviderById(id: number): Promise<OidcProvider | null> {
	const result = await db.select().from(oidcProviders).where(eq(oidcProviders.id, id)).limit(1);
	return result[0] || null;
}

export async function createProvider(
	data: Omit<OidcProvider, 'id' | 'createdAt' | 'updatedAt'>
): Promise<OidcProvider> {
	const now = new Date().toISOString();
	const result = await db
		.insert(oidcProviders)
		.values({
			...data,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return result[0];
}

export async function updateProvider(
	id: number,
	data: Partial<Omit<OidcProvider, 'id' | 'createdAt'>>
): Promise<OidcProvider | null> {
	const now = new Date().toISOString();
	const result = await db
		.update(oidcProviders)
		.set({
			...data,
			updatedAt: now
		})
		.where(eq(oidcProviders.id, id))
		.returning();

	// Clear config cache for this provider
	configCache.delete(id);

	return result[0] || null;
}

export async function deleteProvider(id: number): Promise<boolean> {
	const result = await db.delete(oidcProviders).where(eq(oidcProviders.id, id));
	configCache.delete(id);
	return result.changes > 0;
}

// ============================================
// OIDC Client Configuration
// ============================================

async function getOidcConfig(provider: OidcProvider): Promise<client.Configuration> {
	// Check cache
	const cached = configCache.get(provider.id);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.config;
	}

	// Discover OIDC configuration
	const config = await client.discovery(
		new URL(provider.issuerUrl),
		provider.clientId,
		provider.clientSecret
	);

	// Cache the configuration
	configCache.set(provider.id, {
		config,
		expiresAt: Date.now() + CACHE_TTL_MS
	});

	return config;
}

// ============================================
// Authorization Flow
// ============================================

export interface OidcState {
	providerId: number;
	nonce: string;
	returnUrl?: string;
	linkingUserId?: number; // Set if linking to existing account
}

export function generateState(): string {
	return crypto.randomBytes(32).toString('hex');
}

export function generateNonce(): string {
	return crypto.randomBytes(16).toString('hex');
}

export async function buildAuthorizationUrl(
	provider: OidcProvider,
	redirectUri: string,
	state: string,
	nonce: string
): Promise<string> {
	const config = await getOidcConfig(provider);

	const scopes = JSON.parse(provider.scopes || '["openid", "profile", "email"]') as string[];

	const params = new URLSearchParams({
		client_id: provider.clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: scopes.join(' '),
		state,
		nonce
	});

	// Use the authorization endpoint from discovered config
	const authEndpoint = config.serverMetadata().authorization_endpoint;
	if (!authEndpoint) {
		throw new Error('Authorization endpoint not found in OIDC configuration');
	}

	return `${authEndpoint}?${params.toString()}`;
}

export interface OidcTokenResult {
	accessToken: string;
	idToken: string;
	refreshToken?: string;
	claims: OidcClaims;
}

export interface OidcClaims {
	sub: string; // Subject identifier (unique user ID from provider)
	email?: string;
	email_verified?: boolean;
	name?: string;
	given_name?: string;
	family_name?: string;
	picture?: string;
	preferred_username?: string;
	// Every other ID-token claim (groups, realm_access, ...) is present at runtime
	[claim: string]: unknown;
}

export async function handleCallback(
	provider: OidcProvider,
	callbackUrl: URL,
	redirectUri: string,
	expectedNonce: string,
	expectedState: string
): Promise<OidcTokenResult> {
	const config = await getOidcConfig(provider);

	// Exchange code for tokens
	// openid-client v6 expects the full callback URL with query params (code, state)
	// and validates against expectedState and expectedNonce
	const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
		expectedNonce,
		expectedState,
		idTokenExpected: true
	});

	const accessToken = tokens.access_token;
	const idToken = tokens.id_token;
	const refreshToken = tokens.refresh_token;

	if (!idToken) {
		throw new Error('No ID token received from provider');
	}

	// Get claims from ID token
	const claims = tokens.claims() as OidcClaims;

	if (!claims.sub) {
		throw new Error('No subject claim in ID token');
	}

	return {
		accessToken,
		idToken,
		refreshToken,
		claims
	};
}

// ============================================
// User Linking
// ============================================

export async function findUserByOidc(
	providerId: number,
	oidcSubject: string
): Promise<{ user: typeof users.$inferSelect; link: UserOidcLink } | null> {
	const result = await db
		.select({
			link: userOidcLinks,
			user: users
		})
		.from(userOidcLinks)
		.innerJoin(users, eq(userOidcLinks.userId, users.id))
		.where(
			and(eq(userOidcLinks.providerId, providerId), eq(userOidcLinks.oidcSubject, oidcSubject))
		)
		.limit(1);

	if (result[0]) {
		return { user: result[0].user, link: result[0].link };
	}
	return null;
}

export async function getUserOidcLinks(userId: number): Promise<(UserOidcLink & { provider: OidcProvider })[]> {
	const result = await db
		.select({
			link: userOidcLinks,
			provider: oidcProviders
		})
		.from(userOidcLinks)
		.innerJoin(oidcProviders, eq(userOidcLinks.providerId, oidcProviders.id))
		.where(eq(userOidcLinks.userId, userId));

	return result.map((r) => ({
		...r.link,
		provider: r.provider
	}));
}

export async function linkAccount(
	userId: number,
	providerId: number,
	oidcSubject: string,
	oidcEmail?: string,
	oidcName?: string
): Promise<UserOidcLink> {
	const now = new Date().toISOString();
	const result = await db
		.insert(userOidcLinks)
		.values({
			userId,
			providerId,
			oidcSubject,
			oidcEmail,
			oidcName,
			linkedAt: now,
			lastLoginAt: now,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return result[0];
}

export async function unlinkAccount(userId: number, providerId: number): Promise<boolean> {
	const result = await db
		.delete(userOidcLinks)
		.where(and(eq(userOidcLinks.userId, userId), eq(userOidcLinks.providerId, providerId)));
	return result.changes > 0;
}

export async function updateLastLogin(linkId: number): Promise<void> {
	const now = new Date().toISOString();
	await db
		.update(userOidcLinks)
		.set({ lastLoginAt: now, updatedAt: now })
		.where(eq(userOidcLinks.id, linkId));
}

// ============================================
// Session Management (for OIDC logins)
// ============================================

export async function createSessionForUser(
	user: typeof users.$inferSelect,
	oidcProviderId?: number
): Promise<{ sessionId: string; authUser: AuthUser }> {
	const sessionId = generateSessionId();
	const expires = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const sessionData = JSON.stringify({
		userId: user.id,
		oidcProviderId // Track which provider was used for login
	});

	const now = new Date().toISOString();
	await db.insert(sessions).values({
		sid: sessionId,
		expires,
		data: sessionData,
		createdAt: now,
		updatedAt: now
	});

	const role = user.role || 'member';
	const authUser: AuthUser = {
		id: user.id,
		username: user.username,
		email: user.email,
		role,
		firstName: user.firstName,
		lastName: user.lastName,
		isAdmin: role === 'admin'
	};

	return { sessionId, authUser };
}

// ============================================
// Provider Discovery/Validation
// ============================================

export async function testProviderConnection(
	issuerUrl: string,
	clientId: string,
	clientSecret: string
): Promise<{ success: boolean; error?: string; metadata?: object }> {
	try {
		const config = await client.discovery(new URL(issuerUrl), clientId, clientSecret);

		const metadata = config.serverMetadata();

		// Verify required endpoints exist
		if (!metadata.authorization_endpoint) {
			return { success: false, error: 'Authorization endpoint not found' };
		}
		if (!metadata.token_endpoint) {
			return { success: false, error: 'Token endpoint not found' };
		}

		return {
			success: true,
			metadata: {
				issuer: metadata.issuer,
				authorization_endpoint: metadata.authorization_endpoint,
				token_endpoint: metadata.token_endpoint,
				userinfo_endpoint: metadata.userinfo_endpoint,
				scopes_supported: metadata.scopes_supported
			}
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return { success: false, error: `Failed to discover OIDC configuration: ${message}` };
	}
}

// ============================================
// Slug Generation
// ============================================

export function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export async function isSlugUnique(slug: string, excludeId?: number): Promise<boolean> {
	const query = excludeId
		? db
				.select()
				.from(oidcProviders)
				.where(and(eq(oidcProviders.slug, slug), eq(oidcProviders.id, excludeId)))
		: db.select().from(oidcProviders).where(eq(oidcProviders.slug, slug));

	const result = await query.limit(1);
	return result.length === 0;
}

// ============================================
// 2.33.0: group gate, auto-create, approval, return URLs
// ============================================

export const GROUP_FIELD_MAX = 200;
export const DEFAULT_GROUPS_CLAIM = 'groups';
const PROVISION_ROLES = ['admin', 'librarian', 'member', 'viewer', 'guest'];

function cleanField(value: unknown): string {
	return typeof value === 'string' ? value.trim().slice(0, GROUP_FIELD_MAX).trim() : '';
}

/**
 * Admin save normaliser for the two group-gate fields. Only keys present in `data` come back,
 * so a partial PATCH (the enabled toggle) leaves them alone. Trims and caps; never refuses.
 */
export function normalizeProviderGroupFields(data: Record<string, unknown>): {
	groupsClaim?: string;
	requiredGroup?: string;
} {
	const out: { groupsClaim?: string; requiredGroup?: string } = {};
	if (Object.hasOwn(data, 'groupsClaim')) out.groupsClaim = cleanField(data.groupsClaim) || DEFAULT_GROUPS_CLAIM;
	if (Object.hasOwn(data, 'requiredGroup')) out.requiredGroup = cleanField(data.requiredGroup);
	return out;
}

/**
 * Read a groups claim: the literal key first, then (when the name has dots) a dot path such as
 * realm_access.roles. Own properties only. An array keeps its string elements, a string becomes
 * a one-element list, anything else (or a missing key) is null = absent.
 */
export function readGroupsClaim(source: unknown, claimName: string | null | undefined): string[] | null {
	if (!source || typeof source !== 'object') return null;
	const name = (claimName ?? '').trim() || DEFAULT_GROUPS_CLAIM;
	const obj = source as Record<string, unknown>;
	let value: unknown;
	if (Object.hasOwn(obj, name)) {
		value = obj[name];
	} else if (name.includes('.')) {
		let cur: unknown = obj;
		for (const part of name.split('.')) {
			if (cur && typeof cur === 'object' && !Array.isArray(cur) && Object.hasOwn(cur, part)) {
				cur = (cur as Record<string, unknown>)[part];
			} else {
				return null;
			}
		}
		value = cur;
	} else {
		return null;
	}
	if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
	if (typeof value === 'string') return [value];
	return null;
}

export type GroupGateResult =
	| { allowed: true; source: 'none' | 'id_token' | 'userinfo' }
	| { allowed: false; reason: 'not_member' | 'missing_claim' | 'userinfo_failed'; source: 'id_token' | 'userinfo' };

export interface GroupGateDeps {
	fetchUserInfo: (provider: OidcProvider, accessToken: string, expectedSubject: string) => Promise<Record<string, unknown>>;
}

/** Userinfo fetch through openid-client, which also checks the response's sub against the token's */
export async function fetchProviderUserInfo(
	provider: OidcProvider,
	accessToken: string,
	expectedSubject: string
): Promise<Record<string, unknown>> {
	const config = await getOidcConfig(provider);
	return (await client.fetchUserInfo(config, accessToken, expectedSubject)) as Record<string, unknown>;
}

export const defaultGroupGateDeps: GroupGateDeps = { fetchUserInfo: fetchProviderUserInfo };

/**
 * The minimum-group gate. Inert when requiredGroup is empty (no userinfo call). Otherwise the ID
 * token's claim decides; only when that claim is absent is userinfo asked, and any userinfo error
 * (including a subject mismatch) fails closed. Exact, case-sensitive match after trimming.
 */
export async function checkGroupGate(
	provider: Pick<OidcProvider, 'id' | 'groupsClaim' | 'requiredGroup'>,
	token: Pick<OidcTokenResult, 'accessToken' | 'claims'>,
	deps: GroupGateDeps = defaultGroupGateDeps
): Promise<GroupGateResult> {
	const required = (provider.requiredGroup ?? '').trim();
	if (!required) return { allowed: true, source: 'none' };

	const claimName = (provider.groupsClaim ?? '').trim() || DEFAULT_GROUPS_CLAIM;
	const sub = token.claims.sub;
	const refuse = (reason: 'not_member' | 'missing_claim' | 'userinfo_failed', source: 'id_token' | 'userinfo'): GroupGateResult => {
		console.warn(`[oidc] group gate refused provider=${provider.id} sub=${sub} reason=${reason} source=${source}`);
		return { allowed: false, reason, source };
	};

	let groups = readGroupsClaim(token.claims, claimName);
	let source: 'id_token' | 'userinfo' = 'id_token';
	if (groups === null) {
		source = 'userinfo';
		try {
			const info = await (deps as GroupGateDeps).fetchUserInfo(provider as OidcProvider, token.accessToken, sub);
			if (!info || info.sub !== sub) throw new Error('userinfo subject mismatch');
			groups = readGroupsClaim(info, claimName);
		} catch {
			return refuse('userinfo_failed', source);
		}
		if (groups === null) return refuse('missing_claim', source);
	}
	if (groups.some((g) => g.trim() === required)) return { allowed: true, source };
	return refuse('not_member', source);
}

/** The approval check every OIDC session path runs (local login refuses the same two states) */
export function oidcLoginBlock(
	user: Pick<typeof users.$inferSelect, 'approvalStatus'>
): 'approval_pending' | 'approval_rejected' | null {
	if (user.approvalStatus === 'pending') return 'approval_pending';
	if (user.approvalStatus === 'rejected') return 'approval_rejected';
	return null;
}

/**
 * A redirect target that stays on this site: a path starting with one '/', no '//' or '/\\'
 * prefix, no control characters (browsers strip tabs/newlines, so '/\t/evil' would become
 * '//evil'), and it must resolve to the same origin. Anything else is '/'.
 */
export function safeReturnUrl(u: unknown): string {
	if (typeof u !== 'string' || u === '') return '/';
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(u)) return '/';
	if (!u.startsWith('/') || u.startsWith('//') || u.startsWith('/\\')) return '/';
	try {
		const base = 'http://returnurl.invalid';
		if (new URL(u, base).origin !== base) return '/';
	} catch {
		return '/';
	}
	return u;
}

/** Lowercased, trimmed email claim, or undefined when absent or blank */
export function normalizeOidcEmail(email: unknown): string | undefined {
	if (typeof email !== 'string') return undefined;
	const e = email.trim().toLowerCase();
	return e || undefined;
}

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;

function sanitizeUsername(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	let s = raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '');
	s = s.slice(0, 30).replace(/[-_]+$/g, '');
	return USERNAME_RE.test(s) ? s : null;
}

/**
 * A signup-valid username from the claims: preferred_username, email local part,
 * given-family, name, then 'user'. A case-insensitive collision gets -2 ... -99 (base shortened
 * to keep 30 chars), then user-<6 hex>.
 */
export function deriveOidcUsername(claims: OidcClaims, isTaken: (username: string) => boolean): string {
	const email = typeof claims.email === 'string' ? claims.email : '';
	const given = typeof claims.given_name === 'string' ? claims.given_name : '';
	const family = typeof claims.family_name === 'string' ? claims.family_name : '';
	const candidates: unknown[] = [
		claims.preferred_username,
		email.includes('@') ? email.slice(0, email.indexOf('@')) : email,
		given && family ? `${given}-${family}` : given || family,
		claims.name,
		'user'
	];
	let base = 'user';
	for (const c of candidates) {
		const clean = sanitizeUsername(c);
		if (clean) {
			base = clean;
			break;
		}
	}
	if (!isTaken(base)) return base;
	for (let n = 2; n <= 99; n++) {
		const suffix = `-${n}`;
		const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
		if (!isTaken(candidate)) return candidate;
	}
	for (let i = 0; i < 10; i++) {
		const candidate = `user-${crypto.randomBytes(3).toString('hex')}`;
		if (!isTaken(candidate)) return candidate;
	}
	throw new Error('Could not derive a free username');
}

export type ProvisionResult =
	| { kind: 'created'; user: typeof users.$inferSelect; link: UserOidcLink }
	| { kind: 'linked'; found: { user: typeof users.$inferSelect; link: UserOidcLink } }
	| { kind: 'email_taken' };

export interface ProvisionDeps {
	/** Test seam: runs after the async work and before the transaction opens (the race window) */
	beforeProvisionTx?: () => void;
}

class LinkExistsError extends Error {}

/**
 * Auto-create an account for a new OIDC identity. Writes only the user row and the
 * user_oidc_links row, in one synchronous transaction (the bcrypt hash is computed first).
 * An email held by any account (case-insensitive) is never adopted: email_taken sends the
 * caller to the complete page's link-by-password. If the identity got linked meanwhile (or
 * the link insert fails for any reason and a link now exists) the existing link wins.
 */
export async function provisionOidcUser(
	provider: Pick<OidcProvider, 'id' | 'defaultRole'>,
	claims: OidcClaims,
	deps: ProvisionDeps = {}
): Promise<ProvisionResult> {
	const email = normalizeOidcEmail(claims.email);
	if (email) {
		const hit = db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1).all();
		if (hit.length > 0) return { kind: 'email_taken' };
	}

	const requireApproval = (await getSetting('registration.require_admin_approval')) === 'true';
	const role = PROVISION_ROLES.includes(provider.defaultRole ?? '') ? (provider.defaultRole as string) : 'member';
	// Never shown and never usable: keeps the NOT NULL bcrypt column shape
	const password = await hashPassword(crypto.randomBytes(32).toString('hex'));
	const oidcName = (typeof claims.name === 'string' && claims.name) || (typeof claims.given_name === 'string' && claims.given_name) || undefined;

	deps.beforeProvisionTx?.();

	const attempt = () =>
		db.transaction((tx) => {
			const taken = (name: string) =>
				tx.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = ${name.toLowerCase()}`).limit(1).all().length > 0;
			const username = deriveOidcUsername(claims, taken);
			const now = new Date().toISOString();
			const user = tx
				.insert(users)
				.values({
					username,
					email: email || `${username}@oidc.local`,
					password,
					role,
					firstName: (typeof claims.given_name === 'string' && claims.given_name) || null,
					lastName: (typeof claims.family_name === 'string' && claims.family_name) || null,
					failedLoginAttempts: 0,
					emailVerified: claims.email_verified === true,
					emailVerificationToken: null,
					emailVerificationExpires: null,
					approvalStatus: requireApproval ? 'pending' : 'approved',
					inviteCodeUsed: null,
					createdAt: now,
					updatedAt: now
				})
				.returning()
				.get();
			// Atomic check-then-insert: a link that appeared since the caller's lookup wins, even on a
			// DB without UNIQUE(providerId, oidcSubject)
			const existing = tx
				.select({ id: userOidcLinks.id })
				.from(userOidcLinks)
				.where(and(eq(userOidcLinks.providerId, provider.id), eq(userOidcLinks.oidcSubject, claims.sub)))
				.limit(1)
				.all();
			if (existing.length > 0) throw new LinkExistsError('identity already linked');
			const link = tx
				.insert(userOidcLinks)
				.values({
					userId: user.id,
					providerId: provider.id,
					oidcSubject: claims.sub,
					oidcEmail: email,
					oidcName,
					linkedAt: now,
					lastLoginAt: now,
					createdAt: now,
					updatedAt: now
				})
				.returning()
				.get();
			return { user, link };
		});

	for (let tries = 0; ; tries++) {
		try {
			const { user, link } = attempt();
			return { kind: 'created', user, link };
		} catch (e) {
			// Any failure: if the identity is linked now, that link wins (the race rule)
			const found = await findUserByOidc(provider.id, claims.sub);
			if (found) return { kind: 'linked', found };
			const text = `${e instanceof Error ? e.message : ''} ${String((e as { cause?: unknown })?.cause ?? '')}`;
			if (tries === 0 && text.includes('users.username')) continue;
			throw e;
		}
	}
}

const MAX_LINK_ATTEMPTS = 5;
const LINK_LOCKOUT_MINUTES = 15;

/**
 * Password check for the complete page's link action, counted exactly as authService.login
 * counts: refuse while locked (even a correct password), reset an expired lockout, 5 failures
 * lock for 15 minutes, a success resets the counter.
 */
export async function checkLinkPassword(
	user: Pick<typeof users.$inferSelect, 'id' | 'password' | 'failedLoginAttempts' | 'lockoutUntil'>,
	password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (user.lockoutUntil) {
		const lockoutTime = new Date(user.lockoutUntil);
		if (lockoutTime > new Date()) {
			const minutesLeft = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
			return { ok: false, error: `Account locked. Try again in ${minutesLeft} minute(s)` };
		}
		await db.update(users).set({ failedLoginAttempts: 0, lockoutUntil: null }).where(eq(users.id, user.id));
		user = { ...user, failedLoginAttempts: 0, lockoutUntil: null };
	}

	if (!(await verifyPassword(password, user.password))) {
		const attempts = (user.failedLoginAttempts || 0) + 1;
		if (attempts >= MAX_LINK_ATTEMPTS) {
			const lockoutUntil = new Date(Date.now() + LINK_LOCKOUT_MINUTES * 60000).toISOString();
			await db.update(users).set({ failedLoginAttempts: attempts, lockoutUntil }).where(eq(users.id, user.id));
			return { ok: false, error: `Too many failed attempts. Account locked for ${LINK_LOCKOUT_MINUTES} minutes` };
		}
		await db.update(users).set({ failedLoginAttempts: attempts }).where(eq(users.id, user.id));
		return { ok: false, error: 'Invalid password' };
	}

	await db.update(users).set({ failedLoginAttempts: 0, lockoutUntil: null }).where(eq(users.id, user.id));
	return { ok: true };
}
