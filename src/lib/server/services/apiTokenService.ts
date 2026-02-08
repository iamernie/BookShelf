import { db, apiTokens, users } from '$lib/server/db';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import type { AuthUser } from './authService';

const TOKEN_PREFIX = 'bks_';
const TOKEN_BYTES = 32;

export interface ApiTokenInfo {
	id: number;
	name: string;
	tokenPrefix: string;
	permissions: string[] | null;
	lastUsedAt: string | null;
	expiresAt: string | null;
	createdAt: string | null;
}

export interface CreateTokenResult {
	success: boolean;
	token?: string;
	tokenInfo?: ApiTokenInfo;
	error?: string;
}

function generateToken(): string {
	const randomPart = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
	return TOKEN_PREFIX + randomPart;
}

function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}

function getTokenPrefix(token: string): string {
	return token.substring(0, 12);
}

export async function createToken(
	userId: number,
	name: string,
	permissions: string[] | null = null,
	expiresAt: string | null = null
): Promise<CreateTokenResult> {
	const token = generateToken();
	const hashedToken = hashToken(token);
	const prefix = getTokenPrefix(token);
	const now = new Date().toISOString();

	try {
		const result = await db.insert(apiTokens).values({
			userId,
			name,
			token: hashedToken,
			tokenPrefix: prefix,
			permissions: permissions ? JSON.stringify(permissions) : null,
			expiresAt,
			createdAt: now,
			updatedAt: now
		});

		const tokenId = result.lastInsertRowid as number;

		return {
			success: true,
			token,
			tokenInfo: {
				id: tokenId,
				name,
				tokenPrefix: prefix,
				permissions,
				lastUsedAt: null,
				expiresAt,
				createdAt: now
			}
		};
	} catch (e) {
		console.error('[apiTokenService] Failed to create token:', e);
		return {
			success: false,
			error: 'Failed to create API token'
		};
	}
}

export async function validateToken(token: string): Promise<AuthUser | null> {
	if (!token.startsWith(TOKEN_PREFIX)) {
		return null;
	}

	const hashedToken = hashToken(token);

	const result = await db
		.select({
			tokenId: apiTokens.id,
			userId: apiTokens.userId,
			expiresAt: apiTokens.expiresAt,
			revokedAt: apiTokens.revokedAt,
			permissions: apiTokens.permissions,
			username: users.username,
			email: users.email,
			role: users.role,
			firstName: users.firstName,
			lastName: users.lastName
		})
		.from(apiTokens)
		.innerJoin(users, eq(apiTokens.userId, users.id))
		.where(eq(apiTokens.token, hashedToken))
		.limit(1);

	const tokenRecord = result[0];

	if (!tokenRecord) {
		return null;
	}

	if (tokenRecord.revokedAt) {
		return null;
	}

	if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
		return null;
	}

	await db
		.update(apiTokens)
		.set({ lastUsedAt: new Date().toISOString() })
		.where(eq(apiTokens.id, tokenRecord.tokenId));

	const role = tokenRecord.role || 'member';

	return {
		id: tokenRecord.userId,
		username: tokenRecord.username,
		email: tokenRecord.email,
		role,
		firstName: tokenRecord.firstName,
		lastName: tokenRecord.lastName,
		isAdmin: role === 'admin'
	};
}

export async function listTokens(userId: number): Promise<ApiTokenInfo[]> {
	const result = await db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			tokenPrefix: apiTokens.tokenPrefix,
			permissions: apiTokens.permissions,
			lastUsedAt: apiTokens.lastUsedAt,
			expiresAt: apiTokens.expiresAt,
			createdAt: apiTokens.createdAt
		})
		.from(apiTokens)
		.where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));

	return result.map((row) => ({
		...row,
		permissions: row.permissions ? JSON.parse(row.permissions) : null
	}));
}

export async function getToken(tokenId: number, userId: number): Promise<ApiTokenInfo | null> {
	const result = await db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			tokenPrefix: apiTokens.tokenPrefix,
			permissions: apiTokens.permissions,
			lastUsedAt: apiTokens.lastUsedAt,
			expiresAt: apiTokens.expiresAt,
			createdAt: apiTokens.createdAt,
			revokedAt: apiTokens.revokedAt
		})
		.from(apiTokens)
		.where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
		.limit(1);

	const token = result[0];

	if (!token || token.revokedAt) {
		return null;
	}

	return {
		id: token.id,
		name: token.name,
		tokenPrefix: token.tokenPrefix,
		permissions: token.permissions ? JSON.parse(token.permissions) : null,
		lastUsedAt: token.lastUsedAt,
		expiresAt: token.expiresAt,
		createdAt: token.createdAt
	};
}

export async function revokeToken(
	tokenId: number,
	userId: number
): Promise<{ success: boolean; error?: string }> {
	const result = await db
		.update(apiTokens)
		.set({
			revokedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)));

	if (result.changes === 0) {
		return { success: false, error: 'Token not found' };
	}

	return { success: true };
}

export async function revokeAllTokens(userId: number): Promise<{ success: boolean; count: number }> {
	const result = await db
		.update(apiTokens)
		.set({
			revokedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));

	return { success: true, count: result.changes };
}

export async function updateTokenName(
	tokenId: number,
	userId: number,
	name: string
): Promise<{ success: boolean; error?: string }> {
	const result = await db
		.update(apiTokens)
		.set({
			name,
			updatedAt: new Date().toISOString()
		})
		.where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));

	if (result.changes === 0) {
		return { success: false, error: 'Token not found' };
	}

	return { success: true };
}

export async function cleanExpiredTokens(): Promise<number> {
	const now = new Date().toISOString();
	const result = await db.delete(apiTokens).where(
		and(
			eq(apiTokens.expiresAt, now),
			isNull(apiTokens.revokedAt)
		)
	);
	return result.changes;
}
