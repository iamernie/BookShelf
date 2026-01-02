import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getStatuses, getGenres, getFormats, getNarrators, getTags, getAllAuthors, getAllSeries } from '$lib/server/services/bookService';
import { getSettingAs } from '$lib/server/services/settingsService';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) {
		throw redirect(302, '/login');
	}

	// Check if public library is enabled
	const publicLibraryEnabled = await getSettingAs<boolean>('library.enable_public_library', 'boolean');

	// Check if this is for public library
	const isPublic = url.searchParams.get('public') === 'true';

	// Only admin/librarian can add to public library, and public library must be enabled
	const canAddPublic = publicLibraryEnabled && (user.role === 'admin' || user.role === 'librarian');
	if (isPublic && !canAddPublic) {
		throw redirect(302, '/library/add');
	}

	// Load form options
	const [statuses, genres, formats, narrators, tags, authors, series] = await Promise.all([
		getStatuses(),
		getGenres(),
		getFormats(),
		getNarrators(),
		getTags(),
		getAllAuthors(),
		getAllSeries()
	]);

	return {
		user: {
			id: user.id,
			role: user.role
		},
		isPublic,
		canAddPublic,
		publicLibraryEnabled,
		options: {
			statuses,
			genres,
			formats,
			narrators,
			tags,
			authors,
			series
		}
	};
};
