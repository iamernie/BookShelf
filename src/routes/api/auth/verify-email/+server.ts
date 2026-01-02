import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyEmail, getUserById } from '$lib/server/services/authService';
import { sendWelcomeEmail, isEmailConfigured } from '$lib/server/services/emailService';
import { createLogger } from '$lib/server/services/loggerService';

const log = createLogger('verify-email');

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const body = await request.json();
		const { token } = body;

		if (!token) {
			return json({ message: 'Verification token is required' }, { status: 400 });
		}

		const result = await verifyEmail(token);

		if (!result.success) {
			return json({ message: result.error || 'Verification failed' }, { status: 400 });
		}

		log.info('Email verified successfully');

		return json({
			success: true,
			message: 'Email verified successfully! You can now sign in.'
		});
	} catch (error) {
		log.error('Email verification error', { error });
		return json({ message: 'An error occurred during verification' }, { status: 500 });
	}
};

// GET endpoint for link-based verification
export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return json({ message: 'Verification token is required' }, { status: 400 });
	}

	try {
		const result = await verifyEmail(token);

		if (!result.success) {
			return json(
				{ success: false, message: result.error || 'Verification failed' },
				{ status: 400 }
			);
		}

		return json({
			success: true,
			message: 'Email verified successfully! You can now sign in.'
		});
	} catch (error) {
		log.error('Email verification error', { error });
		return json({ message: 'An error occurred during verification' }, { status: 500 });
	}
};
