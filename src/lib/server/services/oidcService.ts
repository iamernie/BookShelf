import { db, oidcProviders, userOidcLinks, users, sessions } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import * as client from 'openid-client';
import crypto from 'crypto';
import type { OidcProvider, UserOidcLink } from '$lib/server/db/schema';
import { generateSessionId, type AuthUser } from './authService';

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
