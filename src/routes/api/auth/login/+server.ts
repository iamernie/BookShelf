import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { login, isEmailVerified, getUserByEmail, getUserApprovalStatus } from '$lib/server/services/authService';
import { getSetting } from '$lib/server/services/settingsService';
import { loginLimiter } from '$lib/server/middleware/rateLimiter';

export const POST: RequestHandler = async ({ request, cookies }) => {
	// Check rate limit first
	const rateLimit = loginLimiter.check(request, 'login');
	if (!rateLimit.allowed) {
		throw error(429, 'Too many login attempts. Please try again later.');
	}

	const data = await request.json();

	if (!data.email?.trim() || !data.password) {
		throw error(400, { message: 'Email and password are required' });
	}

	const normalizedEmail = data.email.trim().toLowerCase();

	const result = await login(normalizedEmail, data.password);

	if (!result.success) {
		throw error(401, { message: result.error || 'Login failed' });
	}

	// Check if email verification is required
	const requireVerification = await getSetting('registration.require_email_verification');
	if (requireVerification === 'true' && result.user) {
		const verified = await isEmailVerified(result.user.id);
		if (!verified) {
			throw error(403, {
				message: 'Please verify your email address before signing in. Check your inbox for the verification link.'
			});
		}
	}

	// Check approval status
	if (result.user) {
		const approvalStatus = await getUserApprovalStatus(result.user.id);
		if (approvalStatus === 'pending') {
			throw error(403, {
				message: 'Your account is pending approval. An administrator will review your registration soon.'
			});
		}
		if (approvalStatus === 'rejected') {
			throw error(403, {
				message: 'Your account registration was not approved. Please contact an administrator for more information.'
			});
		}
	}

	// Set session cookie
	cookies.set('session', result.sessionId!, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev, // Secure in production (HTTPS), allow HTTP in development
		maxAge: 60 * 60 * 24 * 7 // 7 days
	});

	return json({ user: result.user });
};
