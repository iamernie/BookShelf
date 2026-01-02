import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { logout } from '$lib/server/services/authService';

export const actions: Actions = {
	default: async ({ cookies }) => {
		const sessionId = cookies.get('session');

		if (sessionId) {
			await logout(sessionId);
		}

		cookies.delete('session', { path: '/' });

		throw redirect(303, '/login');
	}
};
