/**
 * Account Preferences API
 * GET /api/account/preferences - Get user preferences
 * PATCH /api/account/preferences - Update user preferences
 * DELETE /api/account/preferences - Reset to defaults
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserPreferences, updateUserPreferences, resetPreferences } from '$lib/server/services/userPreferencesService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const preferences = await getUserPreferences(locals.user.id);
	return json({ preferences });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const body = await request.json();

	// Validate specific fields if needed
	if (body.theme && !['light', 'dark', 'system'].includes(body.theme)) {
		throw error(400, 'Invalid theme value');
	}
	if (body.defaultBooksView && !['grid', 'list', 'table'].includes(body.defaultBooksView)) {
		throw error(400, 'Invalid books view value');
	}
	if (body.readerTheme && !['auto', 'light', 'dark', 'sepia'].includes(body.readerTheme)) {
		throw error(400, 'Invalid reader theme value');
	}
	if (body.booksPerPage && (body.booksPerPage < 12 || body.booksPerPage > 100)) {
		throw error(400, 'Books per page must be between 12 and 100');
	}
	if (body.readerFontSize && (body.readerFontSize < 10 || body.readerFontSize > 32)) {
		throw error(400, 'Font size must be between 10 and 32');
	}

	const preferences = await updateUserPreferences(locals.user.id, body);
	return json({ success: true, preferences });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Not authenticated');
	}

	const preferences = await resetPreferences(locals.user.id);
	return json({ success: true, preferences, message: 'Preferences reset to defaults' });
};
