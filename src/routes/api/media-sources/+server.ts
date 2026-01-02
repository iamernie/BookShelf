/**
 * Media Sources API
 *
 * GET /api/media-sources - Get all media sources (system + user's own)
 * POST /api/media-sources - Create a new media source
 *   - Admins can create system-wide sources (isSystem: true)
 *   - Regular users create private sources (linked to their userId)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllMediaSources, createMediaSource } from '$lib/server/services/mediaSourceService';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	// Return system sources + user's own private sources
	const sources = await getAllMediaSources(locals.user.id);
	return json(sources);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const data = await request.json();

	if (!data.name || typeof data.name !== 'string') {
		throw error(400, 'Name is required');
	}

	try {
		const isAdmin = locals.user.role === 'admin';

		// Only admins can create system-wide sources
		const isSystemSource = isAdmin && data.isSystem === true;

		const source = await createMediaSource(
			{
				name: data.name,
				icon: data.icon || 'shopping-bag',
				color: data.color || '#6c757d',
				url: data.url || null,
				isSystem: isSystemSource,
				displayOrder: data.displayOrder || 0
			},
			isSystemSource ? undefined : locals.user.id // userId for non-system sources
		);

		return json(source, { status: 201 });
	} catch (e) {
		if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
			throw error(400, 'A media source with this name already exists');
		}
		throw e;
	}
};
