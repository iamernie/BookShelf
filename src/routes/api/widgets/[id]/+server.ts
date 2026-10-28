import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteWidget, updateWidget } from '$lib/server/services/widgetService';

// Edit name, theme or item limit of the caller's own widget (type is immutable)
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const widgetId = parseInt(params.id);
	if (isNaN(widgetId)) {
		throw error(400, 'Invalid widget ID');
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	if (!body || typeof body !== 'object') {
		throw error(400, 'Invalid request body');
	}
	if ('type' in body) {
		throw error(400, 'Widget type cannot be changed');
	}

	const result = await updateWidget(widgetId, locals.user.id, {
		name: body.name,
		theme: body.theme,
		itemLimit: body.itemLimit
	});

	if (!result.success) {
		if (result.notFound) throw error(404, 'Widget not found');
		if (result.disabled) throw error(409, result.error);
		throw error(400, result.error);
	}

	return json({ widget: result.widget });
};

// Revoke (delete) the caller's own widget; its URL stops working immediately
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const widgetId = parseInt(params.id);
	if (isNaN(widgetId)) {
		throw error(400, 'Invalid widget ID');
	}

	if (!(await deleteWidget(widgetId, locals.user.id))) {
		throw error(404, 'Widget not found');
	}

	return json({ success: true });
};
