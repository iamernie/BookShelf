import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSyncOverview, listRuns } from '$lib/server/services/absSyncService';
import { listAttention } from '$lib/server/services/absAttentionService';
import { getAbsLinkBaseUrl } from '$lib/server/services/absService';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		throw redirect(303, '/');
	}

	const [overview, runs, attention, absBaseUrl] = await Promise.all([
		getSyncOverview(),
		listRuns({ limit: 25 }),
		listAttention('open'),
		getAbsLinkBaseUrl()
	]);

	return { overview, runs, attention, absBaseUrl };
};
