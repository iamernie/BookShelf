import type { PageServerLoad } from './$types';
import { getFullDashboardData } from '$lib/server/services/dashboardService';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;
	const dashboardData = await getFullDashboardData(userId);

	return dashboardData;
};
