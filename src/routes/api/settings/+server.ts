import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAllSettings,
	getSettingsByCategory,
	setSettings,
	SECRET_SETTING_KEYS,
	SERVER_MANAGED_SETTING_KEYS,
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
		for (const key of SECRET_SETTING_KEYS) {
			if (key in settings) settings[key] = '';
		}
		return json(settings);
	}

	const settings = await getAllSettings();
	return json(settings.map((s) =>
		SECRET_SETTING_KEYS.includes(s.key as SettingKey) ? { ...s, value: '' } : s
	));
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

	const values = { ...body } as Partial<Record<SettingKey, string>>;
	for (const key of SERVER_MANAGED_SETTING_KEYS) {
		delete values[key];
	}

	await setSettings(values);

	return json({ success: true });
};
