import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthorWithBooks, updateAuthor, deleteAuthor } from '$lib/server/services/authorService';

export const GET: RequestHandler = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid author ID' });
	}

	const result = await getAuthorWithBooks(id, locals.user);
	if (!result) {
		throw error(404, { message: 'Author not found' });
	}

	return json(result);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid author ID' });
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Name is required' });
	}

	const author = await updateAuthor(id, {
		name: data.name.trim(),
		bio: data.bio?.trim() || null,
		birthDate: data.birthDate || null,
		deathDate: data.deathDate || null,
		birthPlace: data.birthPlace?.trim() || null,
		photoUrl: data.photoUrl?.trim() || null,
		website: data.website?.trim() || null,
		wikipediaUrl: data.wikipediaUrl?.trim() || null,
		// Absent leaves the shared column alone: notes are per-user (2.31.0) and the forms no longer send it
		comments: data.comments === undefined ? undefined : data.comments?.trim() || null
	});

	if (!author) {
		throw error(404, { message: 'Author not found' });
	}

	return json(author);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, { message: 'Invalid author ID' });
	}

	const deleted = await deleteAuthor(id);
	if (!deleted) {
		throw error(404, { message: 'Author not found' });
	}

	return json({ success: true });
};
