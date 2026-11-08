import type { PageServerLoad } from './$types';
import { getFullDashboardData } from '$lib/server/services/dashboardService';

export const load: PageServerLoad = async ({ locals }) => {
	const dashboardData = await getFullDashboardData(locals.user);

	return dashboardData;
};
