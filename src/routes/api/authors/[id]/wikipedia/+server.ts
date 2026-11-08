import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canManageEntities } from '$lib/server/services/permissionService';
import { getAuthorById, updateAuthor } from '$lib/server/services/authorService';

/**
 * POST /api/authors/:id/wikipedia
 * Import Wikipedia/Fandom data into an existing author record
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!canManageEntities(locals.user)) {
		throw error(403, { message: 'You do not have permission to edit authors' });
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid author ID' });
	}

	const author = await getAuthorById(id);
	if (!author) {
		throw error(404, { message: 'Author not found' });
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

	const updated = await updateAuthor(id, updateData);

	return json({
		success: true,
		message: 'Author data imported successfully',
		author: updated
	});
};
