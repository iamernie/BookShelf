import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) {
		throw redirect(302, '/login');
	}

	// Redirect to unified library add page
	// This page is kept for backwards compatibility but now redirects
	const isPublic = url.searchParams.get('public') === 'true';
	throw redirect(302, isPublic ? '/library/add?public=true' : '/library/add');
};
