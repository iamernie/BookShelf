/**
 * User Service
 * CRUD operations for user management (admin functions)
 */

import { db, users, userPreferences, sessions } from '$lib/server/db';
import { eq, desc, asc, like, or, sql, count } from 'drizzle-orm';
import { hashPassword } from './authService';
import type { UserRole } from '$lib/server/db/schema';

export interface UserListItem {
	id: number;
	username: string;
	email: string;
	role: string;
	firstName: string | null;
	lastName: string | null;
	createdAt: string | null;
	lastLogin?: string | null;
	isLocked: boolean;
}

export interface UserDetail extends UserListItem {
	failedLoginAttempts: number | null;
	lockoutUntil: string | null;
	updatedAt: string | null;
}

export interface CreateUserInput {
	username: string;
	email: string;
	password: string;
	role?: UserRole;
	firstName?: string;
	lastName?: string;
}

export interface UpdateUserInput {
	username?: string;
	email?: string;
	password?: string;
	role?: UserRole;
	firstName?: string;
	lastName?: string;
}

// Valid roles
export const VALID_ROLES: UserRole[] = ['admin', 'librarian', 'member', 'viewer', 'guest'];

export function isValidRole(role: string): role is UserRole {
	return VALID_ROLES.includes(role as UserRole);
}

/**
 * Get all users with pagination and search
 */
export async function getUsers(options: {
	page?: number;
	limit?: number;
	search?: string;
	sortBy?: 'username' | 'email' | 'role' | 'createdAt';
	sortOrder?: 'asc' | 'desc';
} = {}): Promise<{ users: UserListItem[]; total: number; page: number; totalPages: number }> {
	const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;
	const offset = (page - 1) * limit;

	// Build search condition
	let whereCondition;
	if (search) {
		const searchTerm = `%${search}%`;
		whereCondition = or(
			like(users.username, searchTerm),
			like(users.email, searchTerm),
			like(users.firstName, searchTerm),
			like(users.lastName, searchTerm)
		);
	}

	// Get total count
	const totalResult = await db
		.select({ count: count() })
		.from(users)
		.where(whereCondition);
	const total = totalResult[0]?.count ?? 0;

	// Build sort
	const sortColumn = {
		username: users.username,
		email: users.email,
		role: users.role,
		createdAt: users.createdAt
	}[sortBy] || users.createdAt;

	const orderFn = sortOrder === 'asc' ? asc : desc;

	// Get users
	const result = await db
		.select({
			id: users.id,
			username: users.username,
			email: users.email,
			role: users.role,
			firstName: users.firstName,
			lastName: users.lastName,
			createdAt: users.createdAt,
			lockoutUntil: users.lockoutUntil
		})
		.from(users)
		.where(whereCondition)
		.orderBy(orderFn(sortColumn))
		.limit(limit)
		.offset(offset);

	const userList: UserListItem[] = result.map(u => ({
		id: u.id,
		username: u.username,
		email: u.email,
		role: u.role || 'member',
		firstName: u.firstName,
		lastName: u.lastName,
		createdAt: u.createdAt,
		isLocked: u.lockoutUntil ? new Date(u.lockoutUntil) > new Date() : false
	}));

	return {
		users: userList,
		total,
		page,
		totalPages: Math.ceil(total / limit)
	};
}

/**
 * Get user by ID with full details
 */
export async function getUserById(id: number): Promise<UserDetail | null> {
	const result = await db
		.select()
		.from(users)
		.where(eq(users.id, id))
		.limit(1);

	const user = result[0];
	if (!user) return null;

	return {
		id: user.id,
		username: user.username,
		email: user.email,
		role: user.role || 'member',
		firstName: user.firstName,
		lastName: user.lastName,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
		failedLoginAttempts: user.failedLoginAttempts,
		lockoutUntil: user.lockoutUntil,
		isLocked: user.lockoutUntil ? new Date(user.lockoutUntil) > new Date() : false
	};
}

/**
 * Check if username is available
 */
export async function isUsernameAvailable(username: string, excludeUserId?: number): Promise<boolean> {
	const result = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, username))
		.limit(1);

	if (result.length === 0) return true;
	if (excludeUserId && result[0].id === excludeUserId) return true;
	return false;
}

/**
 * Check if email is available
 */
export async function isEmailAvailable(email: string, excludeUserId?: number): Promise<boolean> {
	const result = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email.toLowerCase()))
		.limit(1);

	if (result.length === 0) return true;
	if (excludeUserId && result[0].id === excludeUserId) return true;
	return false;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<{ success: boolean; user?: UserDetail; error?: string }> {
	// Validate
	if (!input.username || input.username.length < 3) {
		return { success: false, error: 'Username must be at least 3 characters' };
	}
	if (!input.email || !input.email.includes('@')) {
		return { success: false, error: 'Valid email is required' };
	}
	if (!input.password || input.password.length < 8) {
		return { success: false, error: 'Password must be at least 8 characters' };
	}

	// Check uniqueness
	if (!await isUsernameAvailable(input.username)) {
		return { success: false, error: 'Username is already taken' };
	}
	if (!await isEmailAvailable(input.email)) {
		return { success: false, error: 'Email is already registered' };
	}

	// Validate role
	const role = input.role || 'member';
	if (!isValidRole(role)) {
		return { success: false, error: 'Invalid role' };
	}

	const hashedPassword = await hashPassword(input.password);
	const now = new Date().toISOString();

	const result = await db.insert(users).values({
		username: input.username,
		email: input.email.toLowerCase(),
		password: hashedPassword,
		role,
		firstName: input.firstName || null,
		lastName: input.lastName || null,
		createdAt: now,
		updatedAt: now
	}).returning({ id: users.id });

	const user = await getUserById(result[0].id);
	return { success: true, user: user! };
}

/**
 * Update a user
 */
export async function updateUser(id: number, input: UpdateUserInput): Promise<{ success: boolean; user?: UserDetail; error?: string }> {
	const existingUser = await getUserById(id);
	if (!existingUser) {
		return { success: false, error: 'User not found' };
	}

	const updates: Record<string, any> = {
		updatedAt: new Date().toISOString()
	};

	// Username change
	if (input.username !== undefined && input.username !== existingUser.username) {
		if (input.username.length < 3) {
			return { success: false, error: 'Username must be at least 3 characters' };
		}
		if (!await isUsernameAvailable(input.username, id)) {
			return { success: false, error: 'Username is already taken' };
		}
		updates.username = input.username;
	}

	// Email change
	if (input.email !== undefined && input.email.toLowerCase() !== existingUser.email.toLowerCase()) {
		if (!input.email.includes('@')) {
			return { success: false, error: 'Valid email is required' };
		}
		if (!await isEmailAvailable(input.email, id)) {
			return { success: false, error: 'Email is already registered' };
		}
		updates.email = input.email.toLowerCase();
	}

	// Password change
	if (input.password) {
		if (input.password.length < 8) {
			return { success: false, error: 'Password must be at least 8 characters' };
		}
		updates.password = await hashPassword(input.password);
	}

	// Role change
	if (input.role !== undefined && input.role !== existingUser.role) {
		if (!isValidRole(input.role)) {
			return { success: false, error: 'Invalid role' };
		}
		updates.role = input.role;
	}

	// Name changes
	if (input.firstName !== undefined) {
		updates.firstName = input.firstName || null;
	}
	if (input.lastName !== undefined) {
		updates.lastName = input.lastName || null;
	}

	await db.update(users).set(updates).where(eq(users.id, id));

	const user = await getUserById(id);
	return { success: true, user: user! };
}

/**
 * Delete a user
 */
export async function deleteUser(id: number): Promise<{ success: boolean; error?: string }> {
	const existingUser = await getUserById(id);
	if (!existingUser) {
		return { success: false, error: 'User not found' };
	}

	// Delete user's sessions first
	await db.delete(sessions).where(
		sql`data LIKE ${'%"userId":' + id + '%'}`
	);

	// Delete user preferences
	await db.delete(userPreferences).where(eq(userPreferences.userId, id));

	// Delete user
	await db.delete(users).where(eq(users.id, id));

	return { success: true };
}

/**
 * Unlock a user account
 */
export async function unlockUser(id: number): Promise<{ success: boolean; error?: string }> {
	const existingUser = await getUserById(id);
	if (!existingUser) {
		return { success: false, error: 'User not found' };
	}

	await db.update(users).set({
		lockoutUntil: null,
		failedLoginAttempts: 0,
		updatedAt: new Date().toISOString()
	}).where(eq(users.id, id));

	return { success: true };
}

/**
 * Change user password (for user self-service)
 */
export async function changePassword(
	userId: number,
	currentPassword: string,
	newPassword: string
): Promise<{ success: boolean; error?: string }> {
	const result = await db
		.select({ password: users.password })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	const user = result[0];
	if (!user) {
		return { success: false, error: 'User not found' };
	}

	// Verify current password
	const bcrypt = await import('bcrypt');
	const isValid = await bcrypt.compare(currentPassword, user.password);
	if (!isValid) {
		return { success: false, error: 'Current password is incorrect' };
	}

	if (newPassword.length < 8) {
		return { success: false, error: 'New password must be at least 8 characters' };
	}

	const hashedPassword = await hashPassword(newPassword);
	await db.update(users).set({
		password: hashedPassword,
		updatedAt: new Date().toISOString()
	}).where(eq(users.id, userId));

	return { success: true };
}

/**
 * Get user count by role (for admin dashboard)
 */
export async function getUserCountsByRole(): Promise<Record<string, number>> {
	const result = await db
		.select({
			role: users.role,
			count: count()
		})
		.from(users)
		.groupBy(users.role);

	const counts: Record<string, number> = {};
	for (const r of result) {
		counts[r.role || 'member'] = r.count;
	}
	return counts;
}
