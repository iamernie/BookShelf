import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getProviders, PROVIDER_PRESETS } from '$lib/server/services/oidcService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	if (locals.user.role !== 'admin') {
		throw redirect(302, '/');
	}

	const providers = await getProviders();

	// Mask secrets
	const maskedProviders = providers.map((p) => ({
		...p,
		clientSecret: p.clientSecret ? '••••••••' : ''
	}));

	return {
		providers: maskedProviders,
		presets: PROVIDER_PRESETS
	};
};
