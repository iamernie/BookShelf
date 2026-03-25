/**
 * API v1 Tag by ID Endpoint
 * GET, PUT, DELETE for individual tags
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { getTagById, updateTag, deleteTag } from '$lib/server/services/tagService';

// Helper to validate token and check API enabled
async function validateRequest(token: string | null): Promise<{ valid: boolean; error?: string; status?: number }> {
	if (!(await areWidgetsEnabled())) {
		return { valid: false, error: 'API is disabled', status: 403 };
	}
	if (!token || !(await validateWidgetToken(token))) {
		return { valid: false, error: 'Invalid or missing API token', status: 401 };
	}
	return { valid: true };
}

/**
 * GET /api/v1/tags/[id] - Get a tag by ID
 */
export const GET: RequestHandler = async ({ url, params }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid tag ID' }, { status: 400 });
	}

	try {
		const tag = await getTagById(id);
		if (!tag) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		return json({ tag });
	} catch (err) {
		console.error('API v1 get tag error:', err);
		return json({ error: 'Failed to fetch tag' }, { status: 500 });
	}
};

/**
 * PUT /api/v1/tags/[id] - Update a tag
 */
export const PUT: RequestHandler = async ({ url, params, request }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid tag ID' }, { status: 400 });
	}

	try {
		const body = await request.json();

		const updated = await updateTag(id, {
			name: body.name,
			color: body.color,
			icon: body.icon
		});

		if (!updated) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		return json({
			tag: { id: updated.id, name: updated.name },
			message: 'Tag updated successfully'
		});
	} catch (err) {
		console.error('API v1 update tag error:', err);
		return json({ error: 'Failed to update tag' }, { status: 500 });
	}
};

/**
 * DELETE /api/v1/tags/[id] - Delete a tag
 */
export const DELETE: RequestHandler = async ({ url, params }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid tag ID' }, { status: 400 });
	}

	try {
		const deleted = await deleteTag(id);
		if (!deleted) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		return json({ message: 'Tag deleted successfully' });
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Failed to delete tag';
		console.error('API v1 delete tag error:', err);
		return json({ error: errorMessage }, { status: 500 });
	}
};
