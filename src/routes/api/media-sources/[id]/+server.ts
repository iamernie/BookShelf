/**
 * Media Source by ID API
 *
 * GET /api/media-sources/[id] - Get a media source by ID
 * PUT /api/media-sources/[id] - Update a media source (owner or admin)
 * DELETE /api/media-sources/[id] - Delete a media source (owner or admin, non-system only)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMediaSourceById, updateMediaSource, deleteMediaSource } from '$lib/server/services/mediaSourceService';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid media source ID');
	}

	const source = await getMediaSourceById(id);
	if (!source) {
		throw error(404, 'Media source not found');
	}

	// Check access: system sources are visible to all, user sources only to owner
	if (source.userId && source.userId !== locals.user.id && locals.user.role !== 'admin') {
		throw error(403, 'Access denied');
	}

	return json(source);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid media source ID');
	}

	// Check permissions
	const existing = await getMediaSourceById(id);
	if (!existing) {
		throw error(404, 'Media source not found');
	}

	const isAdmin = locals.user.role === 'admin';

	// Only admins can edit system sources
	if (existing.isSystem && !isAdmin) {
		throw error(403, 'Only admins can edit system sources');
	}

	// Users can only edit their own sources
	if (existing.userId && existing.userId !== locals.user.id && !isAdmin) {
		throw error(403, 'Access denied');
	}

	const data = await request.json();

	const source = await updateMediaSource(id, {
		name: data.name,
		icon: data.icon,
		color: data.color,
		url: data.url,
		displayOrder: data.displayOrder
	});

	if (!source) {
		throw error(404, 'Media source not found');
	}

	return json(source);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid media source ID');
	}

	const isAdmin = locals.user.role === 'admin';
	const deleted = await deleteMediaSource(id, locals.user.id, isAdmin);

	if (!deleted) {
		throw error(400, 'Cannot delete this media source (system source or not owned by you)');
	}

	return json({ success: true });
};
