import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { existsSync } from 'fs';
import { getBookById } from '$lib/server/services/bookService';
import { canManagePublicLibrary } from '$lib/server/services/permissionService';
import { getSimilarBooks } from '$lib/server/services/recommendationService';
import { getAudiobooksByBookId, getOrCreateProgress, getBookmarks } from '$lib/server/services/audiobookService';
import { getAllTags } from '$lib/server/services/tagService';
import { getAllStatuses } from '$lib/server/services/statusService';
import { getAllMediaSources, getBookMediaSources } from '$lib/server/services/mediaSourceService';
import { ebookExists } from '$lib/server/services/ebookService';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(404, 'Book not found');
	}

	const book = await getBookById(id);
	if (!book) {
		throw error(404, 'Book not found');
	}

	// Get similar books, tags, statuses, and media sources
	const [similarBooks, allTags, allStatuses, allMediaSources, bookMediaSources] = await Promise.all([
		getSimilarBooks(id, 8),
		getAllTags(),
		getAllStatuses(),
		getAllMediaSources(locals.user?.id),
		getBookMediaSources(id)
	]);

	// Check if ebook file exists (using proper path resolution)
	let ebookMissing = false;
	if (book.ebookPath) {
		ebookMissing = !ebookExists(book.ebookPath);
	}

	// Get linked audiobooks with full file info
	const linkedAudiobooks = locals.user
		? await getAudiobooksByBookId(id, locals.user.id)
		: [];

	// Get progress and bookmarks for each audiobook (for embedded player)
	// Also check if audio files exist
	const audiobookData: {
		audiobook: typeof linkedAudiobooks[0];
		progress: Awaited<ReturnType<typeof getOrCreateProgress>> | null;
		bookmarks: Awaited<ReturnType<typeof getBookmarks>>;
		filesMissing: boolean;
		missingFiles: string[];
	}[] = [];

	if (locals.user && linkedAudiobooks.length > 0) {
		for (const audiobook of linkedAudiobooks) {
			const progress = await getOrCreateProgress(audiobook.id, locals.user.id);
			const bookmarks = await getBookmarks(audiobook.id, locals.user.id);

			// Check if audio files exist
			const missingFiles: string[] = [];
			if (audiobook.files && audiobook.files.length > 0) {
				for (const file of audiobook.files) {
					if (!existsSync(file.filePath)) {
						missingFiles.push(file.filename);
					}
				}
			}

			audiobookData.push({
				audiobook,
				progress,
				bookmarks,
				filesMissing: missingFiles.length > 0,
				missingFiles
			});
		}
	}

	// Check if we should auto-open the listen tab
	const autoPlayAudiobook = url.searchParams.get('listen') === 'true';

	return {
		book,
		similarBooks,
		linkedAudiobooks,
		audiobookData,
		autoPlayAudiobook,
		canManagePublicLibrary: canManagePublicLibrary(locals.user),
		allTags,
		allStatuses,
		allMediaSources,
		bookMediaSources,
		ebookMissing
	};
};
