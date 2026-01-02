import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getAllInviteCodes } from '$lib/server/services/inviteCodeService';
import { getPendingApprovals } from '$lib/server/services/authService';
import { getSetting } from '$lib/server/services/settingsService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(302, '/');
	}

	const inviteCodes = await getAllInviteCodes();
	const pendingApprovals = await getPendingApprovals();
	const requireInviteCode = await getSetting('registration.require_invite_code');
	const requireApproval = await getSetting('registration.require_admin_approval');
	const allowSignup = await getSetting('registration.allow_signup');

	return {
		inviteCodes,
		pendingApprovals,
		settings: {
			requireInviteCode: requireInviteCode === 'true',
			requireApproval: requireApproval === 'true',
			allowSignup: allowSignup === 'true'
		}
	};
};
