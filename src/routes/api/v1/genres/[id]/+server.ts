/**
 * API v1 Genre by ID Endpoint
 * GET, PUT, DELETE for individual genres
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { getGenreById, updateGenre, deleteGenre } from '$lib/server/services/genreService';

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
 * GET /api/v1/genres/[id] - Get a genre by ID
 */
export const GET: RequestHandler = async ({ url, params }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid genre ID' }, { status: 400 });
	}

	try {
		const genre = await getGenreById(id);
		if (!genre) {
			return json({ error: 'Genre not found' }, { status: 404 });
		}

		return json({ genre });
	} catch (err) {
		console.error('API v1 get genre error:', err);
		return json({ error: 'Failed to fetch genre' }, { status: 500 });
	}
};

/**
 * PUT /api/v1/genres/[id] - Update a genre
 */
export const PUT: RequestHandler = async ({ url, params, request }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid genre ID' }, { status: 400 });
	}

	try {
		const body = await request.json();

		const updated = await updateGenre(id, {
			name: body.name,
			description: body.description,
			color: body.color,
			icon: body.icon,
			displayOrder: body.displayOrder
		});

		if (!updated) {
			return json({ error: 'Genre not found' }, { status: 404 });
		}

		return json({
			genre: { id: updated.id, name: updated.name },
			message: 'Genre updated successfully'
		});
	} catch (err) {
		console.error('API v1 update genre error:', err);
		return json({ error: 'Failed to update genre' }, { status: 500 });
	}
};

/**
 * DELETE /api/v1/genres/[id] - Delete a genre
 */
export const DELETE: RequestHandler = async ({ url, params }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid genre ID' }, { status: 400 });
	}

	try {
		const deleted = await deleteGenre(id);
		if (!deleted) {
			return json({ error: 'Genre not found' }, { status: 404 });
		}

		return json({ message: 'Genre deleted successfully' });
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Failed to delete genre';
		console.error('API v1 delete genre error:', err);
		return json({ error: errorMessage }, { status: 500 });
	}
};
