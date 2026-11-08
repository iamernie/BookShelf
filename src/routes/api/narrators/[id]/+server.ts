import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNarratorById, updateNarrator, deleteNarrator, getNarratorTags } from '$lib/server/services/narratorService';

export const GET: RequestHandler = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid narrator ID' });
	}

	const narrator = await getNarratorById(id, locals.user);
	if (!narrator) {
		throw error(404, { message: 'Narrator not found' });
	}

	const tags = await getNarratorTags(id);

	return json({ narrator, tags });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid narrator ID' });
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Narrator name is required' });
	}

	const narrator = await updateNarrator(id, {
		name: data.name.trim(),
		bio: data.bio?.trim() || null,
		birthDate: data.birthDate?.trim() || null,
		deathDate: data.deathDate?.trim() || null,
		birthPlace: data.birthPlace?.trim() || null,
		photoUrl: data.photoUrl?.trim() || null,
		website: data.website?.trim() || null,
		wikipediaUrl: data.wikipediaUrl?.trim() || null,
		// Absent leaves the shared column alone: notes are per-user (2.31.0) and the forms no longer send it
		comments: data.comments === undefined ? undefined : data.comments?.trim() || null
	});

	if (!narrator) {
		throw error(404, { message: 'Narrator not found' });
	}

	return json(narrator);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid narrator ID' });
	}

	try {
		const deleted = await deleteNarrator(id);
		if (!deleted) {
			throw error(404, { message: 'Narrator not found' });
		}

		return json({ success: true });
	} catch (err) {
		if (err instanceof Error && err.message.includes('Cannot delete narrator')) {
			throw error(400, { message: err.message });
		}
		throw err;
	}
};
