import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	areWidgetsEnabled,
	resolveWidget,
	touchLastFetched,
	getWidgetData
} from '$lib/server/services/widgetService';
import { renderWidget } from '$lib/server/widgets/render';
import { createLogger } from '$lib/server/services/loggerService';

const log = createLogger('widgets');

// Public HTML widget for iframes. hooks.server.ts skips X-Frame-Options for this path.
// Every failure is the same 404; theme and limit come only from the stored widget.
export const GET: RequestHandler = async ({ params }) => {
	// Toggle first, so a disabled install does no lookup and reveals nothing
	if (!(await areWidgetsEnabled())) {
		throw error(404, 'Not found');
	}

	const widget = await resolveWidget(params.key, params.type);
	if (!widget) {
		throw error(404, 'Not found');
	}

	let html: string;
	try {
		const data = await getWidgetData(widget.type, widget.userId, widget.itemLimit);
		html = renderWidget(widget.type, widget.theme, data);
	} catch (err) {
		log.error('Widget embed error', { widgetId: widget.id, error: err instanceof Error ? err.message : String(err) });
		throw error(500, 'Failed to render widget');
	}

	await touchLastFetched(widget);

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Robots-Tag': 'noindex',
			// Cover images are same-origin; don't send the keyed URL back as a referer
			'Referrer-Policy': 'no-referrer'
		}
	});
};
