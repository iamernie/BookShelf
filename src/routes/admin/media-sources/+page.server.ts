import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllMediaSources } from '$lib/server/services/mediaSourceService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const mediaSources = await getAllMediaSources();

	return {
		mediaSources
	};
};
