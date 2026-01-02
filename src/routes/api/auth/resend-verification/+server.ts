import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resendVerificationEmail } from '$lib/server/services/authService';
import { sendVerificationEmail, isEmailConfigured } from '$lib/server/services/emailService';
import { getSetting } from '$lib/server/services/settingsService';
import { createLogger } from '$lib/server/services/loggerService';

const log = createLogger('resend-verification');

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const body = await request.json();
		const { email } = body;

		if (!email) {
			return json({ message: 'Email is required' }, { status: 400 });
		}

		// Check if email verification is required
		const requireVerification = await getSetting('registration.require_email_verification');
		if (requireVerification !== 'true') {
			return json({ message: 'Email verification is not required' }, { status: 400 });
		}

		const result = await resendVerificationEmail(email);

		if (!result.success) {
			// If there's a specific error (like already verified), return it
			if (result.error) {
				return json({ message: result.error }, { status: 400 });
			}
			// Otherwise, return success (don't reveal if email exists)
			return json({
				success: true,
				message: 'If an account exists with that email, a verification link has been sent.'
			});
		}

		// Send the verification email
		if (result.token && (await isEmailConfigured())) {
			const baseUrl = `${url.protocol}//${url.host}`;
			const emailSent = await sendVerificationEmail(email, result.token, baseUrl);
			if (!emailSent) {
				log.warn('Failed to send verification email', { email });
			}
		}

		return json({
			success: true,
			message: 'If an account exists with that email, a verification link has been sent.'
		});
	} catch (error) {
		log.error('Resend verification error', { error });
		return json({ message: 'An error occurred' }, { status: 500 });
	}
};
