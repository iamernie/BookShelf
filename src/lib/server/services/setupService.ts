/**
 * Setup Service
 * Handles first-run setup wizard logic
 */

import { db } from '$lib/server/db';
import { users, settings, genres, statuses, formats } from '$lib/server/db/schema';
import { count, eq } from 'drizzle-orm';
import { hashPassword } from './authService';

export interface SetupStatus {
	needsSetup: boolean;
	hasUsers: boolean;
	hasGenres: boolean;
	hasStatuses: boolean;
	hasFormats: boolean;
	databaseConnected: boolean;
}

/**
 * Check if initial setup is required
 */
export async function checkSetupNeeded(): Promise<SetupStatus> {
	try {
		// Check if database is accessible
		const [userCount] = await db.select({ count: count() }).from(users);
		const [genreCount] = await db.select({ count: count() }).from(genres);
		const [statusCount] = await db.select({ count: count() }).from(statuses);
		const [formatCount] = await db.select({ count: count() }).from(formats);

		const hasUsers = userCount.count > 0;
		const hasGenres = genreCount.count > 0;
		const hasStatuses = statusCount.count > 0;
		const hasFormats = formatCount.count > 0;

		return {
			needsSetup: !hasUsers,
			hasUsers,
			hasGenres,
			hasStatuses,
			hasFormats,
			databaseConnected: true
		};
	} catch (error) {
		console.error('Setup check failed:', error);
		return {
			needsSetup: true,
			hasUsers: false,
			hasGenres: false,
			hasStatuses: false,
			hasFormats: false,
			databaseConnected: false
		};
	}
}

/**
 * Create the initial admin user
 */
export async function createAdminUser(data: {
	username: string;
	email: string;
	password: string;
	firstName?: string;
	lastName?: string;
}): Promise<{ success: boolean; userId?: number; error?: string }> {
	try {
		// Verify no users exist
		const [userCount] = await db.select({ count: count() }).from(users);
		if (userCount.count > 0) {
			return { success: false, error: 'Users already exist. Setup has already been completed.' };
		}

		// Hash password
		const hashedPassword = await hashPassword(data.password);

		// Create admin user
		const result = await db.insert(users).values({
			username: data.username,
			email: data.email,
			password: hashedPassword,
			role: 'admin',
			firstName: data.firstName || null,
			lastName: data.lastName || null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		return { success: true, userId: Number(result.lastInsertRowid) };
	} catch (error) {
		console.error('Failed to create admin user:', error);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Initialize default data (genres, statuses, formats)
 */
export async function initializeDefaultData(): Promise<{ success: boolean; error?: string }> {
	try {
		const now = new Date().toISOString();

		// Check and create default statuses
		const [statusCount] = await db.select({ count: count() }).from(statuses);
		if (statusCount.count === 0) {
			await db.insert(statuses).values([
				{ name: 'Done', key: 'READ', color: '#10b981', icon: 'circle-check', isSystem: true, sortOrder: 1, createdAt: now, updatedAt: now },
				{ name: 'Currently Reading', key: 'CURRENT', color: '#3b82f6', icon: 'book-open', isSystem: true, sortOrder: 2, createdAt: now, updatedAt: now },
				{ name: 'To Read', key: 'NEXT', color: '#f59e0b', icon: 'bookmark', isSystem: true, sortOrder: 3, createdAt: now, updatedAt: now },
				{ name: 'Did Not Finish', key: 'DNF', color: '#ef4444', icon: 'x-circle', isSystem: true, sortOrder: 4, createdAt: now, updatedAt: now },
				{ name: 'Wishlist', key: 'WISHLIST', color: '#8b5cf6', icon: 'heart', isSystem: true, sortOrder: 5, createdAt: now, updatedAt: now },
				{ name: 'Parked', key: 'PARKED', color: '#6b7280', icon: 'pause-circle', isSystem: true, sortOrder: 6, createdAt: now, updatedAt: now }
			]);
		}

		// Check and create default formats
		const [formatCount] = await db.select({ count: count() }).from(formats);
		if (formatCount.count === 0) {
			await db.insert(formats).values([
				{ name: 'Paperback', createdAt: now, updatedAt: now },
				{ name: 'Hardcover', createdAt: now, updatedAt: now },
				{ name: 'Ebook', createdAt: now, updatedAt: now },
				{ name: 'Audiobook', createdAt: now, updatedAt: now },
				{ name: 'Kindle', createdAt: now, updatedAt: now }
			]);
		}

		// Check and create default genres
		const [genreCount] = await db.select({ count: count() }).from(genres);
		if (genreCount.count === 0) {
			await db.insert(genres).values([
				{ name: 'Fiction', color: '#3b82f6', icon: 'book', slug: 'fiction', displayOrder: 1, createdAt: now, updatedAt: now },
				{ name: 'Non-Fiction', color: '#10b981', icon: 'file-text', slug: 'non-fiction', displayOrder: 2, createdAt: now, updatedAt: now },
				{ name: 'Fantasy', color: '#8b5cf6', icon: 'wand', slug: 'fantasy', displayOrder: 3, createdAt: now, updatedAt: now },
				{ name: 'Science Fiction', color: '#06b6d4', icon: 'rocket', slug: 'sci-fi', displayOrder: 4, createdAt: now, updatedAt: now },
				{ name: 'Mystery', color: '#f59e0b', icon: 'search', slug: 'mystery', displayOrder: 5, createdAt: now, updatedAt: now },
				{ name: 'Thriller', color: '#ef4444', icon: 'zap', slug: 'thriller', displayOrder: 6, createdAt: now, updatedAt: now },
				{ name: 'Romance', color: '#ec4899', icon: 'heart', slug: 'romance', displayOrder: 7, createdAt: now, updatedAt: now },
				{ name: 'Horror', color: '#1f2937', icon: 'skull', slug: 'horror', displayOrder: 8, createdAt: now, updatedAt: now },
				{ name: 'Biography', color: '#78716c', icon: 'user', slug: 'biography', displayOrder: 9, createdAt: now, updatedAt: now },
				{ name: 'History', color: '#a16207', icon: 'clock', slug: 'history', displayOrder: 10, createdAt: now, updatedAt: now }
			]);
		}

		// Mark setup as complete
		await db.insert(settings).values({
			key: 'setup_completed',
			value: 'true',
			type: 'boolean',
			category: 'system'
		}).onConflictDoUpdate({
			target: settings.key,
			set: { value: 'true' }
		});

		await db.insert(settings).values({
			key: 'setup_completed_at',
			value: now,
			type: 'string',
			category: 'system'
		}).onConflictDoUpdate({
			target: settings.key,
			set: { value: now }
		});

		return { success: true };
	} catch (error) {
		console.error('Failed to initialize default data:', error);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

/**
 * Complete the setup process
 */
export async function completeSetup(adminData: {
	username: string;
	email: string;
	password: string;
	firstName?: string;
	lastName?: string;
}): Promise<{ success: boolean; error?: string }> {
	// Create admin user
	const userResult = await createAdminUser(adminData);
	if (!userResult.success) {
		return userResult;
	}

	// Initialize default data
	const dataResult = await initializeDefaultData();
	if (!dataResult.success) {
		return dataResult;
	}

	return { success: true };
}
