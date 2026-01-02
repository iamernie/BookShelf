import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAllSettings,
	getSettingsByCategory,
	setSettings,
	type SettingKey
} from '$lib/server/services/settingsService';

// GET: Get all settings or by category (admin only)
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Only admins can read settings (contains sensitive data like SMTP credentials)
	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const category = url.searchParams.get('category');

	if (category) {
		const settings = await getSettingsByCategory(category);
		return json(settings);
	}

	const settings = await getAllSettings();
	return json(settings);
};

// PUT: Update settings
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Only admins can change settings
	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const body = await request.json();

	if (!body || typeof body !== 'object') {
		throw error(400, 'Invalid request body');
	}

	await setSettings(body as Partial<Record<SettingKey, string>>);

	return json({ success: true });
};
