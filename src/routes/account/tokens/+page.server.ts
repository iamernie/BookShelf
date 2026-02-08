import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listTokens } from '$lib/server/services/apiTokenService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const tokens = await listTokens(locals.user.id);

	return {
		tokens
	};
};
