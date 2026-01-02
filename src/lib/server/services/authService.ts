import { db, users, sessions } from '$lib/server/db';
import { eq, and, gt, lt } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;
const SESSION_EXPIRY_DAYS = 7;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthUser {
	id: number;
	username: string;
	email: string;
	role: string;
	firstName: string | null;
	lastName: string | null;
	isAdmin: boolean;
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	try {
		return await bcrypt.compare(password, hash);
	} catch {
		return false;
	}
}

export function generateSessionId(): string {
	return crypto.randomBytes(32).toString('hex');
}

export async function getUserByEmail(email: string) {
	const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
	return result[0] || null;
}

export async function getUserById(id: number) {
	const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return result[0] || null;
}

export async function login(
	email: string,
	password: string
): Promise<{ success: boolean; user?: AuthUser; sessionId?: string; error?: string }> {
	const user = await getUserByEmail(email);

	if (!user) {
		return { success: false, error: 'Invalid email or password' };
	}

	// Check if locked out
	if (user.lockoutUntil) {
		const lockoutTime = new Date(user.lockoutUntil);
		if (lockoutTime > new Date()) {
			const minutesLeft = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
			return {
				success: false,
				error: `Account locked. Try again in ${minutesLeft} minute(s)`
			};
		}
		// Lockout expired, reset attempts
		await db
			.update(users)
			.set({ failedLoginAttempts: 0, lockoutUntil: null })
			.where(eq(users.id, user.id));
	}

	const passwordValid = await verifyPassword(password, user.password);

	if (!passwordValid) {
		const attempts = (user.failedLoginAttempts || 0) + 1;

		if (attempts >= MAX_LOGIN_ATTEMPTS) {
			const lockoutUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
			await db
				.update(users)
				.set({ failedLoginAttempts: attempts, lockoutUntil })
				.where(eq(users.id, user.id));
			return {
				success: false,
				error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes`
			};
		}

		await db.update(users).set({ failedLoginAttempts: attempts }).where(eq(users.id, user.id));
		return { success: false, error: 'Invalid email or password' };
	}

	// Reset failed attempts on successful login
	await db
		.update(users)
		.set({ failedLoginAttempts: 0, lockoutUntil: null })
		.where(eq(users.id, user.id));

	// Create session
	const sessionId = generateSessionId();
	const expires = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const sessionData = JSON.stringify({ userId: user.id });

	const now = new Date().toISOString();
	await db.insert(sessions).values({
		sid: sessionId,
		expires,
		data: sessionData,
		createdAt: now,
		updatedAt: now
	});

	const role = user.role || 'user';
	return {
		success: true,
		sessionId,
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			role,
			firstName: user.firstName,
			lastName: user.lastName,
			isAdmin: role === 'admin'
		}
	};
}

export async function logout(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.sid, sessionId));
}

export async function getSession(
	sessionId: string
): Promise<{ user: AuthUser; expires: string } | null> {
	const result = await db
		.select()
		.from(sessions)
		.where(and(eq(sessions.sid, sessionId), gt(sessions.expires, new Date().toISOString())))
		.limit(1);

	const session = result[0];
	if (!session || !session.data) {
		return null;
	}

	const data = JSON.parse(session.data);
	const user = await getUserById(data.userId);

	if (!user) {
		// User was deleted, clean up session
		await logout(sessionId);
		return null;
	}

	const role = user.role || 'user';
	return {
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			role,
			firstName: user.firstName,
			lastName: user.lastName,
			isAdmin: role === 'admin'
		},
		expires: session.expires || ''
	};
}

export async function cleanExpiredSessions(): Promise<number> {
	const now = new Date().toISOString();
	const result = await db.delete(sessions).where(lt(sessions.expires, now));
	return result.changes;
}

// Validate credentials without creating a session (for Basic Auth)
export async function validateCredentials(email: string, password: string): Promise<AuthUser | null> {
	const user = await getUserByEmail(email);

	if (!user) {
		return null;
	}

	// Check if locked out
	if (user.lockoutUntil) {
		const lockoutTime = new Date(user.lockoutUntil);
		if (lockoutTime > new Date()) {
			return null;
		}
	}

	const passwordValid = await verifyPassword(password, user.password);

	if (!passwordValid) {
		return null;
	}

	const role = user.role || 'user';
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		role,
		firstName: user.firstName,
		lastName: user.lastName,
		isAdmin: role === 'admin'
	};
}

// Password Reset Functions
const RESET_TOKEN_EXPIRY_HOURS = 1;

export function generateResetToken(): string {
	return crypto.randomBytes(32).toString('hex');
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
	const user = await getUserByEmail(email);

	if (!user) {
		// Don't reveal whether user exists
		return null;
	}

	const resetToken = generateResetToken();
	const resetTokenExpires = new Date(
		Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
	).toISOString();

	await db
		.update(users)
		.set({
			resetToken,
			resetTokenExpires,
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, user.id));

	return resetToken;
}

export async function validateResetToken(
	token: string
): Promise<{ valid: boolean; userId?: number; error?: string }> {
	const result = await db
		.select()
		.from(users)
		.where(eq(users.resetToken, token))
		.limit(1);

	const user = result[0];

	if (!user) {
		return { valid: false, error: 'Invalid or expired reset token' };
	}

	if (!user.resetTokenExpires) {
		return { valid: false, error: 'Invalid or expired reset token' };
	}

	const expiresAt = new Date(user.resetTokenExpires);
	if (expiresAt < new Date()) {
		// Token expired, clear it
		await db
			.update(users)
			.set({ resetToken: null, resetTokenExpires: null })
			.where(eq(users.id, user.id));
		return { valid: false, error: 'Reset token has expired' };
	}

	return { valid: true, userId: user.id };
}

export async function resetPassword(
	token: string,
	newPassword: string
): Promise<{ success: boolean; error?: string }> {
	const validation = await validateResetToken(token);

	if (!validation.valid || !validation.userId) {
		return { success: false, error: validation.error || 'Invalid token' };
	}

	const hashedPassword = await hashPassword(newPassword);

	await db
		.update(users)
		.set({
			password: hashedPassword,
			resetToken: null,
			resetTokenExpires: null,
			failedLoginAttempts: 0,
			lockoutUntil: null,
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, validation.userId));

	return { success: true };
}

// ============================================================================
// User Registration / Signup Functions
// ============================================================================

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

export function generateVerificationToken(): string {
	return crypto.randomBytes(32).toString('hex');
}

export interface SignupInput {
	username: string;
	email: string;
	password: string;
	firstName?: string;
	lastName?: string;
}

export interface SignupResult {
	success: boolean;
	userId?: number;
	verificationToken?: string;
	error?: string;
}

export async function signup(
	input: SignupInput,
	defaultRole: string = 'member',
	approvalStatus: string = 'approved',
	inviteCodeUsed?: string
): Promise<SignupResult> {
	// Check if username is taken
	const existingUsername = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, input.username))
		.limit(1);

	if (existingUsername.length > 0) {
		return { success: false, error: 'Username is already taken' };
	}

	// Check if email is taken
	const existingEmail = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, input.email.toLowerCase()))
		.limit(1);

	if (existingEmail.length > 0) {
		return { success: false, error: 'Email is already registered' };
	}

	// Hash password
	const hashedPassword = await hashPassword(input.password);

	// Generate email verification token
	const verificationToken = generateVerificationToken();
	const verificationExpires = new Date(
		Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
	).toISOString();

	const now = new Date().toISOString();

	// Create user
	const result = await db.insert(users).values({
		username: input.username,
		email: input.email.toLowerCase(),
		password: hashedPassword,
		role: defaultRole,
		firstName: input.firstName || null,
		lastName: input.lastName || null,
		emailVerified: false,
		emailVerificationToken: verificationToken,
		emailVerificationExpires: verificationExpires,
		approvalStatus,
		inviteCodeUsed: inviteCodeUsed || null,
		createdAt: now,
		updatedAt: now
	});

	return {
		success: true,
		userId: result.lastInsertRowid as number,
		verificationToken
	};
}

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
	const result = await db
		.select()
		.from(users)
		.where(eq(users.emailVerificationToken, token))
		.limit(1);

	const user = result[0];

	if (!user) {
		return { success: false, error: 'Invalid verification token' };
	}

	if (user.emailVerified) {
		return { success: false, error: 'Email is already verified' };
	}

	if (!user.emailVerificationExpires) {
		return { success: false, error: 'Invalid verification token' };
	}

	const expiresAt = new Date(user.emailVerificationExpires);
	if (expiresAt < new Date()) {
		return { success: false, error: 'Verification token has expired. Please request a new one.' };
	}

	await db
		.update(users)
		.set({
			emailVerified: true,
			emailVerificationToken: null,
			emailVerificationExpires: null,
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, user.id));

	return { success: true };
}

export async function resendVerificationEmail(
	email: string
): Promise<{ success: boolean; token?: string; error?: string }> {
	const user = await getUserByEmail(email);

	if (!user) {
		// Don't reveal whether user exists
		return { success: true };
	}

	if (user.emailVerified) {
		return { success: false, error: 'Email is already verified' };
	}

	// Generate new verification token
	const verificationToken = generateVerificationToken();
	const verificationExpires = new Date(
		Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
	).toISOString();

	await db
		.update(users)
		.set({
			emailVerificationToken: verificationToken,
			emailVerificationExpires: verificationExpires,
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, user.id));

	return { success: true, token: verificationToken };
}

export async function isEmailVerified(userId: number): Promise<boolean> {
	const result = await db
		.select({ emailVerified: users.emailVerified })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	return result[0]?.emailVerified || false;
}

export async function getUserApprovalStatus(userId: number): Promise<string> {
	const result = await db
		.select({ approvalStatus: users.approvalStatus })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	return result[0]?.approvalStatus || 'approved';
}

export async function approveUser(
	userId: number,
	approvedBy: number
): Promise<{ success: boolean; error?: string }> {
	const result = await db
		.update(users)
		.set({
			approvalStatus: 'approved',
			approvedBy,
			approvedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, userId));

	return { success: result.changes > 0 };
}

export async function rejectUser(
	userId: number,
	approvedBy: number
): Promise<{ success: boolean; error?: string }> {
	const result = await db
		.update(users)
		.set({
			approvalStatus: 'rejected',
			approvedBy,
			approvedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, userId));

	return { success: result.changes > 0 };
}

export async function getPendingApprovals(): Promise<
	Array<{
		id: number;
		username: string;
		email: string;
		firstName: string | null;
		lastName: string | null;
		createdAt: string;
		inviteCodeUsed: string | null;
	}>
> {
	const result = await db
		.select({
			id: users.id,
			username: users.username,
			email: users.email,
			firstName: users.firstName,
			lastName: users.lastName,
			createdAt: users.createdAt,
			inviteCodeUsed: users.inviteCodeUsed
		})
		.from(users)
		.where(eq(users.approvalStatus, 'pending'));

	return result.map((r) => ({
		...r,
		createdAt: r.createdAt || ''
	}));
}
