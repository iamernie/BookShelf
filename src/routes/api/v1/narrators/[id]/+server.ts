/**
 * API v1 Narrator by ID Endpoint
 * GET, PUT, DELETE for individual narrators
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateWidgetToken, areWidgetsEnabled } from '$lib/server/services/widgetService';
import { getNarratorById, updateNarrator, deleteNarrator } from '$lib/server/services/narratorService';

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
 * GET /api/v1/narrators/[id] - Get a narrator by ID
 */
export const GET: RequestHandler = async ({ url, params }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid narrator ID' }, { status: 400 });
	}

	try {
		const narrator = await getNarratorById(id);
		if (!narrator) {
			return json({ error: 'Narrator not found' }, { status: 404 });
		}

		return json({ narrator });
	} catch (err) {
		console.error('API v1 get narrator error:', err);
		return json({ error: 'Failed to fetch narrator' }, { status: 500 });
	}
};

/**
 * PUT /api/v1/narrators/[id] - Update a narrator
 */
export const PUT: RequestHandler = async ({ url, params, request }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid narrator ID' }, { status: 400 });
	}

	try {
		const body = await request.json();

		const updated = await updateNarrator(id, {
			name: body.name,
			bio: body.bio,
			birthDate: body.birthDate,
			deathDate: body.deathDate,
			birthPlace: body.birthPlace,
			photoUrl: body.photoUrl,
			website: body.website,
			wikipediaUrl: body.wikipediaUrl,
			comments: body.comments
		});

		if (!updated) {
			return json({ error: 'Narrator not found' }, { status: 404 });
		}

		return json({
			narrator: { id: updated.id, name: updated.name },
			message: 'Narrator updated successfully'
		});
	} catch (err) {
		console.error('API v1 update narrator error:', err);
		return json({ error: 'Failed to update narrator' }, { status: 500 });
	}
};

/**
 * DELETE /api/v1/narrators/[id] - Delete a narrator
 */
export const DELETE: RequestHandler = async ({ url, params }) => {
	const token = url.searchParams.get('token');
	const validation = await validateRequest(token);
	if (!validation.valid) {
		return json({ error: validation.error }, { status: validation.status });
	}

	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid narrator ID' }, { status: 400 });
	}

	try {
		const deleted = await deleteNarrator(id);
		if (!deleted) {
			return json({ error: 'Narrator not found' }, { status: 404 });
		}

		return json({ message: 'Narrator deleted successfully' });
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Failed to delete narrator';
		console.error('API v1 delete narrator error:', err);
		return json({ error: errorMessage }, { status: 500 });
	}
};
