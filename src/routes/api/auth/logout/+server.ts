import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logout } from '$lib/server/services/authService';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('session');

	if (sessionId) {
		await logout(sessionId);
	}

	cookies.delete('session', { path: '/' });

	return json({ success: true });
};
