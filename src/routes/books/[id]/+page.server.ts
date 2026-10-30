import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getBookById } from '$lib/server/services/bookService';
import { canManagePublicLibrary } from '$lib/server/services/permissionService';
import { getSimilarBooks } from '$lib/server/services/recommendationService';
import { getAllTags } from '$lib/server/services/tagService';
import { getAllStatuses } from '$lib/server/services/statusService';
import { getAllMediaSources, getBookMediaSources } from '$lib/server/services/mediaSourceService';
import { ebookExists } from '$lib/server/services/ebookService';
import { getAbsLinkBaseUrl } from '$lib/server/services/absService';
import { getSeriesBookNotes } from '$lib/server/services/seriesService';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Book not found');
	}

	const book = await getBookById(id);
	if (!book) {
		throw error(404, 'Book not found');
	}

	// Get similar books, tags, statuses, and media sources
	const [similarBooks, allTags, allStatuses, allMediaSources, bookMediaSources, seriesBookNotes] = await Promise.all([
		getSimilarBooks(id, 8),
		getAllTags(),
		getAllStatuses(),
		getAllMediaSources(locals.user?.id),
		getBookMediaSources(id),
		getSeriesBookNotes(book.series.map((s) => s.id), locals.user?.id)
	]);

	// Check if ebook file exists (using proper path resolution)
	let ebookMissing = false;
	if (book.ebookPath) {
		ebookMissing = !ebookExists(book.ebookPath);
	}

	// Audiobookshelf deep link base URL; null unless the integration is enabled in Admin → Settings → Integrations
	const absBaseUrl = await getAbsLinkBaseUrl();

	return {
		book,
		similarBooks,
		canManagePublicLibrary: canManagePublicLibrary(locals.user),
		isAdmin: locals.user?.role === 'admin',
		allTags,
		allStatuses,
		allMediaSources,
		bookMediaSources,
		seriesBookNotes,
		ebookMissing,
		absBaseUrl
	};
};
