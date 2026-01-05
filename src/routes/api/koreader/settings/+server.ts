/**
 * KOReader Settings API (for BookShelf UI)
 *
 * GET /api/koreader/settings - Get current user's KOReader settings
 * PUT /api/koreader/settings - Create or update KOReader credentials
 * PATCH /api/koreader/settings - Toggle sync enabled/disabled
 * DELETE /api/koreader/settings - Delete KOReader credentials
 *
 * These endpoints use standard BookShelf session auth (not KOReader headers)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getKoreaderUser,
	upsertKoreaderUser,
	toggleKoreaderSync,
	deleteKoreaderUser,
	getAllProgress,
	getRecentProgress
} from '$lib/server/services/koreaderService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const koreaderUser = await getKoreaderUser(locals.user.id);
	const progress = koreaderUser ? await getAllProgress(locals.user.id) : [];
	const recentActivity = koreaderUser ? await getRecentProgress(locals.user.id, 5) : [];

	return json({
		configured: !!koreaderUser,
		username: koreaderUser?.username || null,
		password: koreaderUser?.password || null, // For display in settings
		syncEnabled: koreaderUser?.syncEnabled ?? false,
		progressEntries: progress.length,
		recentActivity: recentActivity.map((entry) => ({
			id: entry.id,
			documentHash: entry.documentHash.substring(0, 8) + '...', // Shortened for display
			percentage: entry.percentage,
			device: entry.device,
			timestamp: entry.timestamp,
			updatedAt: entry.updatedAt,
			bookId: entry.bookId,
			bookTitle: entry.bookTitle
		}))
	});
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	let data: { username: string; password: string };
	try {
		data = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (!data.username || data.username.length < 3) {
		throw error(400, 'Username must be at least 3 characters');
	}

	if (!data.password || data.password.length < 6) {
		throw error(400, 'Password must be at least 6 characters');
	}

	try {
		const result = await upsertKoreaderUser(locals.user.id, data.username, data.password);
		return json({
			success: true,
			username: result.username
		});
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
			throw error(400, 'Username already taken');
		}
		throw error(500, 'Failed to save KOReader credentials');
	}
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	let data: { syncEnabled: boolean };
	try {
		data = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (typeof data.syncEnabled !== 'boolean') {
		throw error(400, 'syncEnabled must be a boolean');
	}

	await toggleKoreaderSync(locals.user.id, data.syncEnabled);

	return json({ success: true, syncEnabled: data.syncEnabled });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	await deleteKoreaderUser(locals.user.id);

	return json({ success: true });
};
