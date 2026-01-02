import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/services/userService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const user = await getUserById(locals.user.id);
	if (!user) {
		throw redirect(302, '/login');
	}

	return {
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			createdAt: user.createdAt
		}
	};
};
