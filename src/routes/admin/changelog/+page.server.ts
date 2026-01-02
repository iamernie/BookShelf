import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getAllVersions } from '$lib/server/services/changelogService';

export const load: PageServerLoad = async ({ locals }) => {
	// Require admin access
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(302, '/');
	}

	const changelog = getAllVersions();

	return {
		changelog
	};
};
