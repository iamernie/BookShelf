/**
 * Dashboard Configuration API
 * GET - Fetch user's dashboard configuration
 * PUT - Save user's dashboard configuration
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getDashboardConfig,
	saveDashboardConfig,
	reorderDashboardSections,
	toggleDashboardSection,
	configureSmartCollectionSection,
	resetDashboardConfig,
	DEFAULT_DASHBOARD_CONFIG,
	type DashboardConfig,
	type DashboardSectionId,
	type FilterConfig
} from '$lib/server/services/userPreferencesService';

/**
 * GET /api/dashboard/config
 * Returns the user's dashboard configuration
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const config = await getDashboardConfig(locals.user.id);
		return json({ config });
	} catch (e) {
		console.error('[dashboard/config] GET error:', e);
		throw error(500, 'Failed to fetch dashboard configuration');
	}
};

/**
 * PUT /api/dashboard/config
 * Saves the user's dashboard configuration
 *
 * Body options:
 * - { config: DashboardConfig } - Full config replacement
 * - { action: 'reorder', order: string[] } - Reorder sections
 * - { action: 'toggle', sectionId: string, enabled?: boolean } - Toggle section
 * - { action: 'configure-smart', shelfId?: number, customFilter?: FilterConfig } - Configure smart collection
 * - { action: 'reset' } - Reset to defaults
 */
export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		let config: DashboardConfig;

		// Handle different action types
		if (body.action) {
			switch (body.action) {
				case 'reorder':
					if (!Array.isArray(body.order)) {
						throw error(400, 'Invalid order array');
					}
					config = await reorderDashboardSections(
						locals.user.id,
						body.order as DashboardSectionId[]
					);
					break;

				case 'toggle':
					if (!body.sectionId) {
						throw error(400, 'Missing sectionId');
					}
					config = await toggleDashboardSection(
						locals.user.id,
						body.sectionId as DashboardSectionId,
						body.enabled
					);
					break;

				case 'configure-smart':
					config = await configureSmartCollectionSection(locals.user.id, {
						shelfId: body.shelfId,
						customFilter: body.customFilter as FilterConfig | undefined
					});
					break;

				case 'reset':
					config = await resetDashboardConfig(locals.user.id);
					break;

				default:
					throw error(400, `Unknown action: ${body.action}`);
			}
		} else if (body.config) {
			// Full config replacement
			const newConfig = body.config as DashboardConfig;

			// Validate config structure
			if (!newConfig.sections || !Array.isArray(newConfig.sections)) {
				throw error(400, 'Invalid config: missing sections array');
			}

			// Validate each section
			for (const section of newConfig.sections) {
				if (!section.id || typeof section.enabled !== 'boolean' || typeof section.order !== 'number') {
					throw error(400, 'Invalid section format');
				}
			}

			await saveDashboardConfig(locals.user.id, newConfig);
			config = newConfig;
		} else {
			throw error(400, 'Missing config or action in request body');
		}

		return json({ success: true, config });
	} catch (e) {
		if (e instanceof Error && 'status' in e) {
			throw e; // Re-throw HTTP errors
		}
		console.error('[dashboard/config] PUT error:', e);
		throw error(500, 'Failed to save dashboard configuration');
	}
};
