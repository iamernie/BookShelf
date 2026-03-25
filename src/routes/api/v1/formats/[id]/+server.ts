/**
 * API v1 Format by ID Endpoint
 * GET, PUT, DELETE for individual formats
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { getFormatById, updateFormat, deleteFormat } from '$lib/server/services/formatService';

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
 * GET /api/v1/formats/[id] - Get a format by ID
 */
export const GET: RequestHandler = async ({ url, params }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid format ID' }, { status: 400 });
	}

	try {
		const format = await getFormatById(id);
		if (!format) {
			return json({ error: 'Format not found' }, { status: 404 });
		}

		return json({ format });
	} catch (err) {
		console.error('API v1 get format error:', err);
		return json({ error: 'Failed to fetch format' }, { status: 500 });
	}
};

/**
 * PUT /api/v1/formats/[id] - Update a format
 */
export const PUT: RequestHandler = async ({ url, params, request }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid format ID' }, { status: 400 });
	}

	try {
		const body = await request.json();

		if (!body.name) {
			return json({ error: 'name is required' }, { status: 400 });
		}

		const updated = await updateFormat(id, {
			name: body.name,
			icon: body.icon,
			color: body.color
		});

		if (!updated) {
			return json({ error: 'Format not found' }, { status: 404 });
		}

		return json({
			format: { id: updated.id, name: updated.name },
			message: 'Format updated successfully'
		});
	} catch (err) {
		console.error('API v1 update format error:', err);
		return json({ error: 'Failed to update format' }, { status: 500 });
	}
};

/**
 * DELETE /api/v1/formats/[id] - Delete a format
 */
export const DELETE: RequestHandler = async ({ url, params }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid format ID' }, { status: 400 });
	}

	try {
		const deleted = await deleteFormat(id);
		if (!deleted) {
			return json({ error: 'Format not found' }, { status: 404 });
		}

		return json({ message: 'Format deleted successfully' });
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Failed to delete format';
		console.error('API v1 delete format error:', err);
		return json({ error: errorMessage }, { status: 500 });
	}
};
