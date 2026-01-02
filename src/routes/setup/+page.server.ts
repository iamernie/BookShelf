import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { checkSetupNeeded } from '$lib/server/services/setupService';

export const load: PageServerLoad = async () => {
	const status = await checkSetupNeeded();

	// If setup is not needed, redirect to login
	if (!status.needsSetup) {
		throw redirect(303, '/login');
	}

	return {
		status
	};
};
