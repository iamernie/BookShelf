import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProviderBySlug,
	buildAuthorizationUrl,
	generateState,
	generateNonce,
	type OidcState
} from '$lib/server/services/oidcService';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const GET: RequestHandler = async ({ params, cookies, url, locals }) => {
	const { provider: providerSlug } = params;

	// Get provider configuration
	const provider = await getProviderBySlug(providerSlug);

	if (!provider) {
		throw redirect(302, '/login?error=provider_not_found');
	}

	if (!provider.enabled) {
		throw redirect(302, '/login?error=provider_disabled');
	}

	// Generate state and nonce for CSRF protection
	const state = generateState();
	const nonce = generateNonce();

	// Build redirect URI - use the callback endpoint
	const baseUrl = env.PUBLIC_BASE_URL || url.origin;
	const redirectUri = `${baseUrl}/auth/oidc/callback`;

	// Store state data in a cookie
	const stateData: OidcState = {
		providerId: provider.id,
		nonce,
		returnUrl: url.searchParams.get('returnUrl') || '/',
		// If user is logged in, this is an account linking request
		linkingUserId: locals.user?.id
	};

	cookies.set('oidc_state', JSON.stringify({ state, ...stateData }), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60 * 10 // 10 minutes
	});

	// Build authorization URL and redirect to OIDC provider
	const authUrl = await buildAuthorizationUrl(provider, redirectUri, state, nonce);
	throw redirect(302, authUrl);
};
