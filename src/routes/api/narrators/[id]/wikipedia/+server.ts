import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canManageEntities } from '$lib/server/services/permissionService';
import { getNarratorById, updateNarrator } from '$lib/server/services/narratorService';

/**
 * POST /api/narrators/:id/wikipedia
 * Import Wikipedia/Fandom data into an existing narrator record
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!canManageEntities(locals.user)) {
		throw error(403, { message: 'You do not have permission to edit narrators' });
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid narrator ID' });
	}

	const narrator = await getNarratorById(id, locals.user);
	if (!narrator) {
		throw error(404, { message: 'Narrator not found' });
	}

	const data = await request.json();
	const { bio, birthDate, deathDate, birthPlace, photoUrl, website, wikipediaUrl } = data;

	// Only update fields that are provided and not empty
	const updateData: Record<string, string | null> = {};
	if (bio) updateData.bio = bio;
	if (birthDate) updateData.birthDate = birthDate;
	if (deathDate) updateData.deathDate = deathDate;
	if (birthPlace) updateData.birthPlace = birthPlace;
	if (photoUrl) updateData.photoUrl = photoUrl;
	if (website) updateData.website = website;
	if (wikipediaUrl) updateData.wikipediaUrl = wikipediaUrl;

	const updated = await updateNarrator(id, updateData);

	return json({
		success: true,
		message: 'Narrator data imported successfully',
		narrator: updated
	});
};
