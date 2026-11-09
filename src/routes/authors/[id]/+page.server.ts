import type { PageServerLoad } from './$types';
import { getAuthorWithBooks } from '$lib/server/services/authorService';
import { getAllTags, getAuthorTags } from '$lib/server/services/tagService';
import { getAllStatuses } from '$lib/server/services/statusService';
import { getAllNarrators } from '$lib/server/services/narratorService';
import { getAllFormats } from '$lib/server/services/formatService';
import { getAllGenres } from '$lib/server/services/genreService';
import { getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { hasPermission, Permission, canManageEntities } from '$lib/server/services/permissionService';
import { getEntityNotes } from '$lib/server/services/entityNotesService';
import { entityShareState } from '$lib/server/services/libraryShareService';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid author ID');
	}

	// Edit, delete, bio and tag controls render for catalog editors only; the pickers feed their bulk edit only
	const canEdit = canManageEntities(locals.user ?? null);
	const none = Promise.resolve([] as { id: number; name: string }[]);

	const [result, tags, authorTags, statuses, authors, narrators, allSeries, formats, genres] = await Promise.all([
		getAuthorWithBooks(id, locals.user),
		getAllTags(),
		getAuthorTags(id),
		getAllStatuses(),
		canEdit ? getAllAuthors(locals.user) : none,
		canEdit ? getAllNarrators(locals.user) : none,
		canEdit ? getAllSeries(locals.user) : Promise.resolve([] as { id: number; title: string }[]),
		getAllFormats(),
		getAllGenres()
	]);

	if (!result) {
		throw error(404, 'Author not found');
	}

	// The viewer's own notes only
	const myNotes = locals.user ? await getEntityNotes(locals.user.id, 'author', id) : null;
	// Share to public library (and the admin un-share) counts
	const share = await entityShareState(locals.user, 'author', id);

	return {
		author: result.author,
		authorTags,
		books: result.books,
		series: result.series,
		canEdit,
		myNotes,
		canWriteNotes: hasPermission(locals.user ?? null, Permission.EDIT_OWN_BOOKS),
		...share,
		options: {
			tags,
			statuses,
			authors,
			narrators,
			series: allSeries,
			formats,
			genres
		}
	};
};
