import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createWidget, listWidgets } from '$lib/server/services/widgetService';
import { widgetUrls } from '$lib/server/widgets/urls';

// List the caller's own widgets
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	return json(await listWidgets(locals.user.id));
};

// Create a widget; the raw key is returned once, here
export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (locals.user.role === 'guest') {
		throw error(403, 'Guests cannot create widgets');
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

	const result = await createWidget(locals.user.id, {
		type: body.type,
		theme: body.theme,
		itemLimit: body.itemLimit,
		name: body.name
	});

	if (!result.success) {
		throw error(400, result.error);
	}

	return json(
		{
			widget: result.widget,
			key: result.key,
			urls: widgetUrls(url.origin, result.key, result.widget.type)
		},
		{ status: 201 }
	);
};
