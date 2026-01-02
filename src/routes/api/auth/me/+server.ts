import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/services/authService';

export const GET: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('session');

	if (!sessionId) {
		throw error(401, { message: 'Not authenticated' });
	}

	const session = await getSession(sessionId);

	if (!session) {
		cookies.delete('session', { path: '/' });
		throw error(401, { message: 'Session expired' });
	}

	return json({ user: session.user });
};
