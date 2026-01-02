import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getUsers, getUserCountsByRole, VALID_ROLES } from '$lib/server/services/userService';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(302, '/');
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const search = url.searchParams.get('search') || undefined;
	const sortBy = url.searchParams.get('sortBy') as 'username' | 'email' | 'role' | 'createdAt' | undefined;
	const sortOrder = url.searchParams.get('sortOrder') as 'asc' | 'desc' | undefined;

	const [usersData, roleCounts] = await Promise.all([
		getUsers({ page, limit: 20, search, sortBy, sortOrder }),
		getUserCountsByRole()
	]);

	return {
		...usersData,
		roleCounts,
		roles: VALID_ROLES,
		currentUserId: locals.user.id
	};
};
