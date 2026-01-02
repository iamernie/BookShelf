import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getAudiobooks, getContinueListening, getRecentlyPlayed } from '$lib/server/services/audiobookService';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) {
		throw redirect(302, '/login');
	}

	const filter = (url.searchParams.get('filter') as 'all' | 'in_progress' | 'completed' | 'not_started') || 'all';
	const search = url.searchParams.get('search') || undefined;
	const sortBy = (url.searchParams.get('sortBy') as 'title' | 'author' | 'createdAt' | 'duration') || 'createdAt';
	const sortOrder = (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

	const [audiobooks, continueListening, recentlyPlayed] = await Promise.all([
		getAudiobooks({
			userId: user.id,
			limit: 50,
			filter,
			search,
			sortBy,
			sortOrder
		}),
		getContinueListening(user.id, 5),
		getRecentlyPlayed(user.id, 10)
	]);

	return {
		audiobooks,
		continueListening,
		recentlyPlayed,
		filter,
		search,
		sortBy,
		sortOrder
	};
};
