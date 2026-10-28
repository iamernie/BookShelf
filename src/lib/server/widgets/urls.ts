import type { WidgetType } from '$lib/server/services/widgetService';

/**
 * Public URLs for a widget key. Only built right after create/rotate,
 * since the raw key is never stored.
 */
export function widgetUrls(origin: string, key: string, type: WidgetType): { json: string; embed: string } {
	return {
		json: `${origin}/widgets/api/w/${key}/${type}`,
		embed: `${origin}/widgets/embed/w/${key}/${type}`
	};
}
