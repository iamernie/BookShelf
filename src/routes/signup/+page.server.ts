import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getSetting } from '$lib/server/services/settingsService';
import { isEmailConfigured } from '$lib/server/services/emailService';

export const load: PageServerLoad = async ({ locals }) => {
	// If already logged in, redirect to home
	if (locals.user) {
		throw redirect(302, '/');
	}

	// Check if signup is enabled
	const allowSignup = await getSetting('registration.allow_signup');
	if (allowSignup !== 'true') {
		throw redirect(302, '/login');
	}

	const requireVerification = await getSetting('registration.require_email_verification');
	const requireInviteCode = await getSetting('registration.require_invite_code');
	const requireApproval = await getSetting('registration.require_admin_approval');
	const emailConfigured = isEmailConfigured();

	return {
		requiresVerification: requireVerification === 'true',
		requiresInviteCode: requireInviteCode === 'true',
		requiresApproval: requireApproval === 'true',
		emailConfigured
	};
};
