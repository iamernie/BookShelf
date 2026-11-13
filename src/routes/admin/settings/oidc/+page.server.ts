import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getProviders, PROVIDER_PRESETS } from '$lib/server/services/oidcService';
import { getLocalLoginAdminState } from '$lib/server/services/localLoginService';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ locals, url }) => {
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
		presets: PROVIDER_PRESETS,
		// Password sign-in panel: state only, never the emergency secret
		localLogin: await getLocalLoginAdminState(locals.user.id),
		localLoginOrigin: (env.ORIGIN?.trim() || url.origin).replace(/\/+$/, '')
	};
};
