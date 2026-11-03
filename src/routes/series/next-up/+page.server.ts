import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getSeriesNextUp } from '$lib/server/services/audibleSuggestService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	return {
		// Saved Audible lists only: never calls Audible on page load
		nextUp: await getSeriesNextUp(locals.user.id),
		canAddBooks: hasPermission(locals.user, Permission.ADD_BOOKS)
	};
};
