import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkSetupNeeded, completeSetup } from '$lib/server/services/setupService';

export const POST: RequestHandler = async ({ request }) => {
	// First check if setup is still needed
	const status = await checkSetupNeeded();
	if (!status.needsSetup) {
		return json({ message: 'Setup has already been completed' }, { status: 400 });
	}

	try {
		const data = await request.json();

		// Validate required fields
		if (!data.username || !data.email || !data.password) {
			return json({ message: 'Username, email, and password are required' }, { status: 400 });
		}

		// Validate username
		if (data.username.length < 3) {
			return json({ message: 'Username must be at least 3 characters' }, { status: 400 });
		}

		// Validate email
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
			return json({ message: 'Invalid email address' }, { status: 400 });
		}

		// Validate password
		if (data.password.length < 8) {
			return json({ message: 'Password must be at least 8 characters' }, { status: 400 });
		}

		// Complete setup
		const result = await completeSetup({
			username: data.username,
			email: data.email,
			password: data.password,
			firstName: data.firstName,
			lastName: data.lastName
		});

		if (!result.success) {
			return json({ message: result.error || 'Setup failed' }, { status: 500 });
		}

		return json({ success: true, message: 'Setup completed successfully' });
	} catch (error) {
		console.error('Setup API error:', error);
		return json({ message: 'An error occurred during setup' }, { status: 500 });
	}
};

export const GET: RequestHandler = async () => {
	const status = await checkSetupNeeded();
	return json(status);
};
