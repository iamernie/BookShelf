import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateResetToken, resetPassword } from '$lib/server/services/authService';
import { createLogger } from '$lib/server/services/loggerService';

const log = createLogger('reset-password');

// GET - Validate token
export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return json({ valid: false, message: 'Token is required' }, { status: 400 });
	}

	const validation = await validateResetToken(token);

	return json({
		valid: validation.valid,
		message: validation.error || 'Token is valid'
	});
};

// POST - Reset password
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { token, password } = await request.json();

		if (!token) {
			return json({ message: 'Token is required' }, { status: 400 });
		}

		if (!password) {
			return json({ message: 'Password is required' }, { status: 400 });
		}

		if (password.length < 8) {
			return json({ message: 'Password must be at least 8 characters' }, { status: 400 });
		}

		const result = await resetPassword(token, password);

		if (!result.success) {
			return json({ message: result.error || 'Failed to reset password' }, { status: 400 });
		}

		log.info('Password reset successful');
		return json({ success: true, message: 'Password has been reset successfully' });
	} catch (error) {
		log.error('Error in reset-password', { error });
		return json({ message: 'An error occurred' }, { status: 500 });
	}
};
