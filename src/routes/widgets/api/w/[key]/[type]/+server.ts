import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	areWidgetsEnabled,
	resolveWidget,
	touchLastFetched,
	getWidgetData
} from '$lib/server/services/widgetService';
import { createLogger } from '$lib/server/services/loggerService';

const log = createLogger('widgets');

// Public JSON widget. The key is the only credential; theme and limit come from the
// stored widget, never from the request. Every failure is the same 404.
export const GET: RequestHandler = async ({ params }) => {
	// Toggle first, so a disabled install does no lookup and reveals nothing
	if (!(await areWidgetsEnabled())) {
		throw error(404, 'Not found');
	}

	const widget = await resolveWidget(params.key, params.type);
	if (!widget) {
		throw error(404, 'Not found');
	}

	let data;
	try {
		data = await getWidgetData(widget.type, widget.userId, widget.itemLimit);
	} catch (err) {
		log.error('Widget API error', { widgetId: widget.id, error: err instanceof Error ? err.message : String(err) });
		throw error(500, 'Failed to fetch widget data');
	}

	await touchLastFetched(widget);

	return json(
		{
			type: widget.type,
			theme: widget.theme,
			...data,
			generatedAt: new Date().toISOString()
		},
		{
			headers: {
				'Cache-Control': 'no-store',
				'X-Robots-Tag': 'noindex'
			}
		}
	);
};
