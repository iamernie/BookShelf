import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { canReachBook, canViewBook, canEditBookCatalog, holdsBook, sharedByForViewer, hideOwnerFrom } from '$lib/server/services/libraryShareService';
import { getBookById } from '$lib/server/services/bookService';
import { canManagePublicLibrary, hasPermission, isAdmin as isAdminUser, Permission } from '$lib/server/services/permissionService';
import { getSimilarBooks } from '$lib/server/services/recommendationService';
import { getAllTags } from '$lib/server/services/tagService';
import { getAllStatuses } from '$lib/server/services/statusService';
import { getAllMediaSources, getBookMediaSources } from '$lib/server/services/mediaSourceService';
import { ebookExists } from '$lib/server/services/ebookService';
import { getAbsLinkBaseUrl } from '$lib/server/services/absService';
import { getSeriesBookNotes } from '$lib/server/services/seriesService';
import { getEntityNotesMap } from '$lib/server/services/entityNotesService';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Book not found');
	}

	// A book the viewer can't see doesn't open (admins and librarians see every book); personal
	// fields on it are the viewer's own
	if (!locals.user || !(await canViewBook(locals.user, id))) {
		throw error(404, 'Book not found');
	}

	const found = await getBookById(id, locals.user.id);
	if (!found) {
		throw error(404, 'Book not found');
	}
	// A public book's owner is admin-only ("shared by"); members get neither the id nor the name
	const book = hideOwnerFrom(locals.user, found);
	const sharedBy = (await sharedByForViewer(locals.user, [found])).get(found.id) ?? null;
	const isAdmin = isAdminUser(locals.user);
	const isOwner = found.ownerId !== null && found.ownerId === locals.user.id;

	// Get similar books, tags, statuses, and media sources
	const [similarBooks, allTags, allStatuses, allMediaSources, bookMediaSources, seriesBookNotes, inLibrary, canAdd, mySeriesNotes] = await Promise.all([
		getSimilarBooks(id, 8, locals.user.id),
		getAllTags(),
		getAllStatuses(),
		getAllMediaSources(locals.user?.id),
		getBookMediaSources(id),
		getSeriesBookNotes(book.series.map((s) => s.id), locals.user?.id),
		holdsBook(locals.user.id, id),
		canReachBook(locals.user.id, id),
		// The viewer's own notes on the book's series, keyed by series id
		getEntityNotesMap(locals.user.id, 'series', book.series.map((s) => s.id))
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
		isAdmin,
		sharedBy,
		// Promote: the owner or an admin, and only a book with content (ABS or an ebook);
		// un-promote: admins only, whatever the book holds (PATCH /api/books/[id]/library)
		canPromote: found.libraryType !== 'public' && (isAdmin || isOwner) && (found.absItemId !== null || !!found.ebookPath),
		canUnpromote: found.libraryType === 'public' && isAdmin,
		// Reading needs the book in the viewer's library; Read on a book they only reach asks to Add it
		inLibrary,
		// Add, reading and every personal or edit write stay on role-blind reach: a manager looking at
		// a member's private book by role alone gets the page without the controls that would 403
		canAdd,
		// Tags and media sources are the book's shared catalog: their editors render only with the
		// authority the tag toggle and media-source writes check
		canEditCatalog: await canEditBookCatalog(locals.user, found),
		allTags,
		allStatuses,
		allMediaSources,
		bookMediaSources,
		seriesBookNotes,
		mySeriesNotes,
		canWriteNotes: hasPermission(locals.user, Permission.EDIT_OWN_BOOKS),
		ebookMissing,
		absBaseUrl
	};
};
