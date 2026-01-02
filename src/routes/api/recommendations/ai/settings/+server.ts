import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAISettings, saveAISettings, testAIConnection } from '$lib/server/services/recommendationService';

// GET - Get AI settings (admin only)
export const GET: RequestHandler = async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
		const settings = await getAISettings();
		// Don't return the actual API key, just whether it's set
		return json({
			enabled: settings.enabled,
			hasApiKey: !!settings.apiKey,
			model: settings.model
		});
	} catch (err) {
		console.error('Get AI settings error:', err);
		throw error(500, 'Failed to get settings');
	}
};

// PUT - Update AI settings (admin only)
export const PUT: RequestHandler = async ({ locals, request }) => {
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
		const data = await request.json();
		await saveAISettings(data);
		return json({ success: true });
	} catch (err) {
		console.error('Save AI settings error:', err);
		throw error(500, 'Failed to save settings');
	}
};

// POST - Test API connection (admin only)
export const POST: RequestHandler = async ({ locals, request }) => {
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
		const { apiKey } = await request.json();

		if (!apiKey) {
			throw error(400, 'API key is required');
		}

		const result = await testAIConnection(apiKey);
		return json(result);
	} catch (err) {
		if (err instanceof Response) throw err;
		console.error('Test connection error:', err);
		throw error(500, 'Failed to test connection');
	}
};
