import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasPermission, Permission } from '$lib/server/services/permissionService';
import { getAuthors, createAuthor } from '$lib/server/services/authorService';

export const GET: RequestHandler = async ({ url, locals }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '24');
	const search = url.searchParams.get('search') || undefined;
	const sort = (url.searchParams.get('sort') as 'name' | 'bookCount' | 'createdAt') || 'name';
	const order = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';

	const result = await getAuthors({ page, limit, search, sort, order, viewer: locals.user });
	return json(result);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	// Creating stays open to everyone who can add books: the book forms create authors, series and narrators inline
	if (!hasPermission(locals.user, Permission.ADD_BOOKS)) {
		throw error(403, { message: 'You do not have permission to add authors' });
	}

	const data = await request.json();

	if (!data.name?.trim()) {
		throw error(400, { message: 'Name is required' });
	}

	const author = await createAuthor({
		name: data.name.trim(),
		bio: data.bio?.trim() || null,
		birthDate: data.birthDate || null,
		deathDate: data.deathDate || null,
		birthPlace: data.birthPlace?.trim() || null,
		photoUrl: data.photoUrl?.trim() || null,
		website: data.website?.trim() || null,
		wikipediaUrl: data.wikipediaUrl?.trim() || null
	});

	return json(author, { status: 201 });
};
