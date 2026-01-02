import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	validateWidgetToken,
	areWidgetsEnabled,
	getWidgetData,
	type WidgetType,
	type WidgetTheme
} from '$lib/server/services/widgetService';

const VALID_TYPES: WidgetType[] = ['currently-reading', 'recent-reads', 'stats', 'goal'];

export const GET: RequestHandler = async ({ params, url }) => {
	const { type } = params;
	const token = url.searchParams.get('token');
	const theme = (url.searchParams.get('theme') || 'light') as WidgetTheme;
	const limit = parseInt(url.searchParams.get('limit') || '5', 10);

	// Validate type
	if (!VALID_TYPES.includes(type as WidgetType)) {
		throw error(400, `Invalid widget type. Must be one of: ${VALID_TYPES.join(', ')}`);
	}

	// Check if widgets are enabled
	if (!(await areWidgetsEnabled())) {
		throw error(403, 'Widgets are disabled');
	}

	// Validate token
	if (!token || !(await validateWidgetToken(token))) {
		throw error(401, 'Invalid or missing widget token');
	}

	try {
		const data = await getWidgetData(type as WidgetType, Math.min(limit, 20));

		return json({
			type,
			theme,
			...data
		});
	} catch (err) {
		console.error('Widget API error:', err);
		throw error(500, 'Failed to fetch widget data');
	}
};
