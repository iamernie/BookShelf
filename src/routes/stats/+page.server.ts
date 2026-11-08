import type { PageServerLoad } from './$types';
import { getDashboardStats, getReadingTimeline } from '$lib/server/services/statsService';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;
	const [stats, timeline] = await Promise.all([
		getDashboardStats(locals.user),
		getReadingTimeline(undefined, userId)
	]);
	return { stats, timeline };
};
