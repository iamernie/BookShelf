import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { signup, getUserByEmail } from '$lib/server/services/authService';
import { getSetting } from '$lib/server/services/settingsService';
import { sendVerificationEmail, isEmailConfigured } from '$lib/server/services/emailService';
import { validateInviteCode, useInviteCode } from '$lib/server/services/inviteCodeService';
import { createLogger } from '$lib/server/services/loggerService';
import { signupLimiter } from '$lib/server/middleware/rateLimiter';

const log = createLogger('signup');

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		// Check rate limit first
		const rateLimit = signupLimiter.check(request, 'signup');
		if (!rateLimit.allowed) {
			log.warn('Rate limit exceeded for signup');
			return json(
				{ message: 'Too many registration attempts. Please try again later.' },
				{
					status: 429,
					headers: { 'Retry-After': String(rateLimit.retryAfter) }
				}
			);
		}

		// Check if signup is enabled
		const allowSignup = await getSetting('registration.allow_signup');
		if (allowSignup !== 'true') {
			return json({ message: 'Registration is currently disabled' }, { status: 403 });
		}

		const body = await request.json();
		const { username, email, password, firstName, lastName, inviteCode } = body;

		// Validate required fields
		if (!username || !email || !password) {
			return json({ message: 'Username, email, and password are required' }, { status: 400 });
		}

		// Check if invite code is required
		const requireInviteCode = await getSetting('registration.require_invite_code');
		if (requireInviteCode === 'true') {
			if (!inviteCode) {
				return json({ message: 'An invite code is required to register' }, { status: 400 });
			}

			const validation = await validateInviteCode(inviteCode);
			if (!validation.valid) {
				return json({ message: validation.error || 'Invalid invite code' }, { status: 400 });
			}
		}

		// Validate username format
		if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
			return json(
				{
					message:
						'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'
				},
				{ status: 400 }
			);
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return json({ message: 'Please enter a valid email address' }, { status: 400 });
		}

		// Validate password strength
		if (password.length < 8) {
			return json({ message: 'Password must be at least 8 characters long' }, { status: 400 });
		}

		// Get registration settings
		const requireVerification = await getSetting('registration.require_email_verification');
		const requireApproval = await getSetting('registration.require_admin_approval');
		const defaultRole = await getSetting('registration.default_role');

		// Determine approval status
		const approvalStatus = requireApproval === 'true' ? 'pending' : 'approved';

		// Attempt signup
		const result = await signup(
			{
				username,
				email,
				password,
				firstName: firstName || undefined,
				lastName: lastName || undefined
			},
			defaultRole || 'member',
			approvalStatus,
			inviteCode?.toUpperCase() || undefined
		);

		if (!result.success) {
			return json({ message: result.error || 'Registration failed' }, { status: 400 });
		}

		// Mark invite code as used
		if (inviteCode && requireInviteCode === 'true') {
			await useInviteCode(inviteCode);
		}

		// Build response message based on what's required
		let message = 'Account created successfully!';
		const requirements: string[] = [];

		if (requireVerification === 'true') {
			requirements.push('verify your email');

			// Send verification email
			if (result.verificationToken) {
				const baseUrl = `${url.protocol}//${url.host}`;

				if (await isEmailConfigured()) {
					const emailSent = await sendVerificationEmail(email, result.verificationToken, baseUrl);
					if (!emailSent) {
						log.warn('Failed to send verification email', { email, userId: result.userId });
					}
				} else {
					log.warn('Email not configured, verification email not sent', {
						email,
						userId: result.userId
					});
				}
			}
		}

		if (requireApproval === 'true') {
			requirements.push('wait for admin approval');
		}

		if (requirements.length > 0) {
			message = `Account created! Please ${requirements.join(' and ')} before signing in.`;
		} else {
			message = 'Account created successfully! You can now sign in.';
		}

		return json({
			success: true,
			message,
			requiresVerification: requireVerification === 'true',
			requiresApproval: requireApproval === 'true'
		});
	} catch (error) {
		log.error('Signup error', { error });
		return json({ message: 'An error occurred during registration' }, { status: 500 });
	}
};

// GET endpoint to check if signup is enabled and requirements
export const GET: RequestHandler = async () => {
	try {
		const allowSignup = await getSetting('registration.allow_signup');
		const requireVerification = await getSetting('registration.require_email_verification');
		const requireInviteCode = await getSetting('registration.require_invite_code');
		const requireApproval = await getSetting('registration.require_admin_approval');
		const emailConfigured = isEmailConfigured();

		return json({
			signupEnabled: allowSignup === 'true',
			requiresVerification: requireVerification === 'true',
			requiresInviteCode: requireInviteCode === 'true',
			requiresApproval: requireApproval === 'true',
			emailConfigured
		});
	} catch (error) {
		return json({
			signupEnabled: false,
			requiresVerification: true,
			requiresInviteCode: false,
			requiresApproval: false,
			emailConfigured: false
		});
	}
};
