import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPasswordResetToken } from '$lib/server/services/authService';
import { sendPasswordResetEmail, isEmailConfigured } from '$lib/server/services/emailService';
import { createLogger } from '$lib/server/services/loggerService';
import { passwordResetLimiter } from '$lib/server/middleware/rateLimiter';

const log = createLogger('forgot-password');

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		// Check rate limit first
		const rateLimit = passwordResetLimiter.check(request, 'forgot-password');
		if (!rateLimit.allowed) {
			log.warn('Rate limit exceeded for password reset', {
				remaining: rateLimit.remaining,
				retryAfter: rateLimit.retryAfter
			});
			return json(
				{ message: 'Too many password reset requests. Please try again later.' },
				{
					status: 429,
					headers: { 'Retry-After': String(rateLimit.retryAfter) }
				}
			);
		}

		const { email } = await request.json();

		if (!email) {
			return json({ message: 'Email is required' }, { status: 400 });
		}

		// Always return success to prevent email enumeration
		const successMessage = 'If an account exists with that email, you will receive a password reset link.';

		// Check if email is configured
		if (!isEmailConfigured()) {
			log.warn('Password reset requested but SMTP not configured', { email });
			// Still return success message to prevent enumeration
			return json({ success: true, message: successMessage });
		}

		// Create reset token
		const resetToken = await createPasswordResetToken(email);

		if (resetToken) {
			// Build base URL for reset link
			const baseUrl = `${url.protocol}//${url.host}`;

			// Send email
			const emailSent = await sendPasswordResetEmail(email, resetToken, baseUrl);

			if (!emailSent) {
				log.error('Failed to send password reset email', { email });
			} else {
				log.info('Password reset email sent', { email });
			}
		} else {
			log.debug('Password reset requested for non-existent email', { email });
		}

		return json({ success: true, message: successMessage });
	} catch (error) {
		log.error('Error in forgot-password', { error });
		return json({ message: 'An error occurred' }, { status: 500 });
	}
};
