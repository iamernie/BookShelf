import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rotateWidgetKey } from '$lib/server/services/widgetService';
import { widgetUrls } from '$lib/server/widgets/urls';

// Issue a new key for the caller's own widget; the old URL stops working
export const POST: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const widgetId = parseInt(params.id);
	if (isNaN(widgetId)) {
		throw error(400, 'Invalid widget ID');
	}

	const result = await rotateWidgetKey(widgetId, locals.user.id);

	if (!result.success) {
		if ('disabled' in result && result.disabled) throw error(409, result.error);
		throw error(404, 'Widget not found');
	}

	return json({
		widget: result.widget,
		key: result.key,
		urls: widgetUrls(url.origin, result.key, result.widget.type)
	});
};
