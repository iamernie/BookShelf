/**
 * Invite Code Service
 * Manages invite codes for user registration
 */

import { db, inviteCodes, users } from '$lib/server/db';
import { eq, and, gt, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface InviteCode {
	id: number;
	code: string;
	label: string | null;
	maxUses: number | null;
	usedCount: number;
	expiresAt: string | null;
	isActive: boolean;
	createdBy: number | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateInviteCodeInput {
	label?: string;
	maxUses?: number;
	expiresAt?: string;
}

/**
 * Generate a random invite code
 */
export function generateInviteCode(): string {
	// Generate a readable code like "BOOK-ABCD-1234"
	const prefix = 'BOOK';
	const letters = crypto.randomBytes(2).toString('hex').toUpperCase();
	const numbers = Math.floor(1000 + Math.random() * 9000).toString();
	return `${prefix}-${letters}-${numbers}`;
}

/**
 * Create a new invite code
 */
export async function createInviteCode(
	input: CreateInviteCodeInput,
	createdBy: number
): Promise<InviteCode> {
	const code = generateInviteCode();
	const now = new Date().toISOString();

	const result = await db.insert(inviteCodes).values({
		code,
		label: input.label || null,
		maxUses: input.maxUses || null,
		usedCount: 0,
		expiresAt: input.expiresAt || null,
		isActive: true,
		createdBy,
		createdAt: now,
		updatedAt: now
	});

	const [newCode] = await db
		.select()
		.from(inviteCodes)
		.where(eq(inviteCodes.id, result.lastInsertRowid as number))
		.limit(1);

	return newCode as InviteCode;
}

/**
 * Get all invite codes
 */
export async function getAllInviteCodes(): Promise<InviteCode[]> {
	const codes = await db
		.select()
		.from(inviteCodes)
		.orderBy(sql`${inviteCodes.createdAt} DESC`);

	return codes as InviteCode[];
}

/**
 * Get invite code by code string
 */
export async function getInviteCodeByCode(code: string): Promise<InviteCode | null> {
	const [result] = await db
		.select()
		.from(inviteCodes)
		.where(eq(inviteCodes.code, code.toUpperCase()))
		.limit(1);

	return (result as InviteCode) || null;
}

/**
 * Validate an invite code
 * Returns { valid: true } or { valid: false, error: string }
 */
export async function validateInviteCode(
	code: string
): Promise<{ valid: boolean; inviteCode?: InviteCode; error?: string }> {
	const inviteCode = await getInviteCodeByCode(code);

	if (!inviteCode) {
		return { valid: false, error: 'Invalid invite code' };
	}

	if (!inviteCode.isActive) {
		return { valid: false, error: 'This invite code has been deactivated' };
	}

	if (inviteCode.expiresAt) {
		const expiresAt = new Date(inviteCode.expiresAt);
		if (expiresAt < new Date()) {
			return { valid: false, error: 'This invite code has expired' };
		}
	}

	if (inviteCode.maxUses !== null && inviteCode.usedCount >= inviteCode.maxUses) {
		return { valid: false, error: 'This invite code has reached its usage limit' };
	}

	return { valid: true, inviteCode };
}

/**
 * Use an invite code (increment usedCount)
 */
export async function useInviteCode(code: string): Promise<boolean> {
	const validation = await validateInviteCode(code);
	if (!validation.valid || !validation.inviteCode) {
		return false;
	}

	await db
		.update(inviteCodes)
		.set({
			usedCount: validation.inviteCode.usedCount + 1,
			updatedAt: new Date().toISOString()
		})
		.where(eq(inviteCodes.code, code.toUpperCase()));

	return true;
}

/**
 * Deactivate an invite code
 */
export async function deactivateInviteCode(id: number): Promise<boolean> {
	const result = await db
		.update(inviteCodes)
		.set({
			isActive: false,
			updatedAt: new Date().toISOString()
		})
		.where(eq(inviteCodes.id, id));

	return result.changes > 0;
}

/**
 * Activate an invite code
 */
export async function activateInviteCode(id: number): Promise<boolean> {
	const result = await db
		.update(inviteCodes)
		.set({
			isActive: true,
			updatedAt: new Date().toISOString()
		})
		.where(eq(inviteCodes.id, id));

	return result.changes > 0;
}

/**
 * Delete an invite code
 */
export async function deleteInviteCode(id: number): Promise<boolean> {
	const result = await db.delete(inviteCodes).where(eq(inviteCodes.id, id));
	return result.changes > 0;
}

/**
 * Update an invite code
 */
export async function updateInviteCode(
	id: number,
	updates: Partial<Pick<InviteCode, 'label' | 'maxUses' | 'expiresAt' | 'isActive'>>
): Promise<InviteCode | null> {
	await db
		.update(inviteCodes)
		.set({
			...updates,
			updatedAt: new Date().toISOString()
		})
		.where(eq(inviteCodes.id, id));

	const [updated] = await db.select().from(inviteCodes).where(eq(inviteCodes.id, id)).limit(1);

	return (updated as InviteCode) || null;
}

/**
 * Get users who used a specific invite code
 */
export async function getUsersByInviteCode(code: string): Promise<{ id: number; username: string; email: string }[]> {
	const result = await db
		.select({
			id: users.id,
			username: users.username,
			email: users.email
		})
		.from(users)
		.where(eq(users.inviteCodeUsed, code.toUpperCase()));

	return result;
}
