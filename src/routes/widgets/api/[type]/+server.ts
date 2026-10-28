import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	areWidgetsEnabled,
	getWidgetData,
	type WidgetType,
	type WidgetTheme
} from '$lib/server/services/widgetService';

const VALID_TYPES: WidgetType[] = ['currently-reading', 'recent-reads', 'stats', 'goal', 'next-up', 'upcoming-releases'];

export const GET: RequestHandler = async ({ params, url }) => {
	const { type } = params;
	const theme = (url.searchParams.get('theme') || 'light') as WidgetTheme;
	// Clamp to 1..20; non-numeric falls back to 5 (LIMIT -1 would be unlimited in SQLite)
	const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit') || '', 10) || 5, 20));

	// Check enabled first so a disabled install doesn't reveal which widget types exist
	if (!(await areWidgetsEnabled())) {
		throw error(404, 'Not found');
	}

	// Validate type
	if (!VALID_TYPES.includes(type as WidgetType)) {
		throw error(400, `Invalid widget type. Must be one of: ${VALID_TYPES.join(', ')}`);
	}

	try {
		const data = await getWidgetData(type as WidgetType, limit);

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
