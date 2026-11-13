import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { getUserByEmail, hashPassword } from '$lib/server/services/authService';
import { getSetting } from '$lib/server/services/settingsService';
import {
	getProviderById,
	linkAccount,
	createSessionForUser,
	checkLinkPassword,
	oidcLoginBlock,
	safeReturnUrl
} from '$lib/server/services/oidcService';
import { loginLimiter } from '$lib/server/middleware/rateLimiter';
import { db, users } from '$lib/server/db';
import { getSessionCookieOptions } from '$lib/server/utils/cookies';

interface OidcPendingData {
	providerId: number;
	providerName: string;
	claims: {
		sub: string;
		email?: string;
		email_verified?: boolean;
		name?: string;
		given_name?: string;
		family_name?: string;
	};
	returnUrl?: string;
}

export const load: PageServerLoad = async ({ cookies }) => {
	// Get pending OIDC data from cookie
	const pendingCookie = cookies.get('oidc_pending');

	if (!pendingCookie) {
		throw redirect(302, '/login?error=session_expired');
	}

	let pendingData: OidcPendingData;
	try {
		pendingData = JSON.parse(pendingCookie);
	} catch {
		throw redirect(302, '/login?error=invalid_session');
	}

	// Check if email matches an existing user
	const existingUser = pendingData.claims.email
		? await getUserByEmail(pendingData.claims.email)
		: null;

	// Check if signup is allowed
	const allowSignup = (await getSetting('registration.allow_signup')) === 'true';
	const requireApproval = (await getSetting('registration.require_admin_approval')) === 'true';

	// Nothing to link and no way to create: send them back with a fixed message, not a dead-end form
	if (!existingUser && !allowSignup) {
		const provider = await getProviderById(pendingData.providerId);
		cookies.delete('oidc_pending', { path: '/' });
		throw redirect(
			302,
			`/login?error=oidc_no_account${provider ? `&provider=${encodeURIComponent(provider.slug)}` : ''}`
		);
	}

	return {
		providerName: pendingData.providerName,
		email: pendingData.claims.email,
		name: pendingData.claims.name || `${pendingData.claims.given_name || ''} ${pendingData.claims.family_name || ''}`.trim(),
		givenName: pendingData.claims.given_name,
		familyName: pendingData.claims.family_name,
		hasExistingAccount: !!existingUser,
		existingUsername: existingUser?.username,
		signupAllowed: allowSignup,
		requireApproval
	};
};

export const actions: Actions = {
	// Link to existing account
	link: async ({ request, cookies }) => {
		const pendingCookie = cookies.get('oidc_pending');
		if (!pendingCookie) {
			throw redirect(302, '/login?error=session_expired');
		}

		let pendingData: OidcPendingData;
		try {
			pendingData = JSON.parse(pendingCookie);
		} catch {
			throw redirect(302, '/login?error=invalid_session');
		}

		// Same per-IP limiter as the password login, under its own key
		const rateLimit = loginLimiter.check(request, 'oidc-link');
		if (!rateLimit.allowed) {
			return fail(429, { linkError: 'Too many attempts. Please try again later.' });
		}

		const formData = await request.formData();
		const password = formData.get('password') as string;

		if (!password) {
			return fail(400, { linkError: 'Password is required' });
		}

		// Get existing user by email
		const user = pendingData.claims.email
			? await getUserByEmail(pendingData.claims.email)
			: null;

		if (!user) {
			return fail(400, { linkError: 'No account found with this email' });
		}

		// Verify password, with the account lockout counted exactly as the password login counts it
		const passwordCheck = await checkLinkPassword(user, password);
		if (!passwordCheck.ok) {
			return fail(400, { linkError: passwordCheck.error });
		}

		// A pending or rejected account gets no link and no session, as at the password login
		const block = oidcLoginBlock(user);
		if (block) {
			cookies.delete('oidc_pending', { path: '/' });
			throw redirect(302, `/login?error=${block}`);
		}

		// Link the account
		await linkAccount(
			user.id,
			pendingData.providerId,
			pendingData.claims.sub,
			pendingData.claims.email,
			pendingData.claims.name
		);

		// Create session
		const { sessionId } = await createSessionForUser(user, pendingData.providerId);

		// Clear pending cookie
		cookies.delete('oidc_pending', { path: '/' });

		// Set session cookie
		cookies.set('session', sessionId, getSessionCookieOptions());

		throw redirect(302, safeReturnUrl(pendingData.returnUrl));
	},

	// Create new account
	create: async ({ request, cookies }) => {
		const pendingCookie = cookies.get('oidc_pending');
		if (!pendingCookie) {
			throw redirect(302, '/login?error=session_expired');
		}

		let pendingData: OidcPendingData;
		try {
			pendingData = JSON.parse(pendingCookie);
		} catch {
			throw redirect(302, '/login?error=invalid_session');
		}

		// Check if signup is allowed
		const allowSignup = (await getSetting('registration.allow_signup')) === 'true';
		if (!allowSignup) {
			return fail(400, { createError: 'Account registration is disabled' });
		}

		const formData = await request.formData();
		const username = formData.get('username') as string;
		const password = formData.get('password') as string;

		if (!username || username.length < 3) {
			return fail(400, { createError: 'Username must be at least 3 characters' });
		}

		if (!password || password.length < 8) {
			return fail(400, { createError: 'Password must be at least 8 characters' });
		}

		// Check if email already exists
		if (pendingData.claims.email) {
			const existing = await getUserByEmail(pendingData.claims.email);
			if (existing) {
				return fail(400, { createError: 'An account with this email already exists. Please link instead.' });
			}
		}

		// Get provider for default role
		const provider = await getProviderById(pendingData.providerId);
		const requireApproval = (await getSetting('registration.require_admin_approval')) === 'true';
		const defaultRole = provider?.defaultRole || 'member';

		// Create user
		const now = new Date().toISOString();
		const hashedPassword = await hashPassword(password);

		try {
			const result = await db
				.insert(users)
				.values({
					username,
					email: pendingData.claims.email || `${username}@oidc.local`,
					password: hashedPassword,
					firstName: pendingData.claims.given_name || null,
					lastName: pendingData.claims.family_name || null,
					role: defaultRole,
					emailVerified: pendingData.claims.email_verified ?? false,
					approvalStatus: requireApproval ? 'pending' : 'approved',
					createdAt: now,
					updatedAt: now
				})
				.returning();

			const user = result[0];

			// Link the OIDC account
			await linkAccount(
				user.id,
				pendingData.providerId,
				pendingData.claims.sub,
				pendingData.claims.email,
				pendingData.claims.name
			);

			// If approval is required, redirect to pending page
			if (requireApproval) {
				cookies.delete('oidc_pending', { path: '/' });
				throw redirect(302, '/login?notice=approval_pending');
			}

			// Create session
			const { sessionId } = await createSessionForUser(user, pendingData.providerId);

			// Clear pending cookie
			cookies.delete('oidc_pending', { path: '/' });

			// Set session cookie
			cookies.set('session', sessionId, getSessionCookieOptions());

			throw redirect(302, safeReturnUrl(pendingData.returnUrl));
		} catch (e) {
			if (e instanceof Response || (e as { status?: number })?.status === 302) {
				throw e;
			}
			const message = e instanceof Error ? e.message : 'Failed to create account';
			if (message.includes('UNIQUE constraint failed')) {
				return fail(400, { createError: 'Username already taken' });
			}
			return fail(500, { createError: message });
		}
	},

	// Cancel and go back to login
	cancel: async ({ cookies }) => {
		cookies.delete('oidc_pending', { path: '/' });
		throw redirect(302, '/login');
	}
};
