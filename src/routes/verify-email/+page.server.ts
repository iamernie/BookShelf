import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	// If already logged in, redirect to home
	if (locals.user) {
		throw redirect(302, '/');
	}

	const token = url.searchParams.get('token');

	return {
		token
	};
};
