import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getSetting } from '$lib/server/services/settingsService';
import { getEnabledProviders } from '$lib/server/services/oidcService';

export const load: PageServerLoad = async ({ locals, url }) => {
	// If already logged in, redirect to home
	if (locals.user) {
		throw redirect(302, '/');
	}

	// Check if signup is enabled to show the link
	const allowSignup = await getSetting('registration.allow_signup');

	// Get enabled OIDC providers
	const providers = await getEnabledProviders();
	const oidcProviders = providers.map((p) => ({
		slug: p.slug,
		name: p.name,
		iconUrl: p.iconUrl,
		buttonColor: p.buttonColor
	}));

	// Get any error from query params
	const error = url.searchParams.get('error');
	const errorMessage = url.searchParams.get('message');

	return {
		signupEnabled: allowSignup === 'true',
		oidcProviders,
		oidcError: error ? (errorMessage || error) : null
	};
};
