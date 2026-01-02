import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProviderById,
	handleCallback,
	findUserByOidc,
	linkAccount,
	updateLastLogin,
	createSessionForUser,
	type OidcState
} from '$lib/server/services/oidcService';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const GET: RequestHandler = async ({ url, cookies }) => {
	// Get authorization code and state from query params
	const code = url.searchParams.get('code');
	const returnedState = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	// Handle provider errors
	if (error) {
		console.error('[oidc] Provider error:', error, errorDescription);
		throw redirect(302, `/login?error=oidc_error&message=${encodeURIComponent(errorDescription || error)}`);
	}

	if (!code || !returnedState) {
		throw redirect(302, '/login?error=invalid_callback');
	}

	// Retrieve and validate state from cookie
	const stateCookie = cookies.get('oidc_state');
	if (!stateCookie) {
		throw redirect(302, '/login?error=state_expired');
	}

	let stateData: OidcState & { state: string };
	try {
		stateData = JSON.parse(stateCookie);
	} catch {
		throw redirect(302, '/login?error=invalid_state');
	}

	// Validate state matches
	if (stateData.state !== returnedState) {
		throw redirect(302, '/login?error=state_mismatch');
	}

	// Clear the state cookie
	cookies.delete('oidc_state', { path: '/' });

	// Get provider configuration
	const provider = await getProviderById(stateData.providerId);
	if (!provider) {
		throw redirect(302, '/login?error=provider_not_found');
	}

	// Build redirect URI (must match what was sent in authorization request)
	const baseUrl = env.PUBLIC_BASE_URL || url.origin;
	const redirectUri = `${baseUrl}/auth/oidc/callback`;

	// Build the full callback URL that openid-client v6 needs
	// It extracts the code and state from the URL's query parameters
	const callbackUrl = new URL(url.pathname + url.search, baseUrl);

	try {
		// Exchange code for tokens and get user claims
		const tokenResult = await handleCallback(provider, callbackUrl, redirectUri, stateData.nonce, stateData.state);
		const { claims } = tokenResult;

		// Check if this OIDC identity is already linked to a user
		const existingLink = await findUserByOidc(provider.id, claims.sub);

		// Handle account linking request (user was already logged in)
		if (stateData.linkingUserId) {
			if (existingLink) {
				if (existingLink.user.id === stateData.linkingUserId) {
					// Already linked to this user - just redirect back
					throw redirect(302, '/account/settings?linked=already');
				} else {
					// Linked to a different user - can't link to two accounts
					throw redirect(302, '/account/settings?error=already_linked');
				}
			}

			// Create the link
			await linkAccount(
				stateData.linkingUserId,
				provider.id,
				claims.sub,
				claims.email,
				claims.name || claims.given_name
			);

			throw redirect(302, '/account/settings?linked=true');
		}

		// Not a linking request - this is a login attempt
		if (existingLink) {
			// User already linked - log them in
			await updateLastLogin(existingLink.link.id);
			const { sessionId } = await createSessionForUser(existingLink.user, provider.id);

			cookies.set('session', sessionId, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				maxAge: 60 * 60 * 24 * 7 // 7 days
			});

			throw redirect(302, stateData.returnUrl || '/');
		}

		// New OIDC user - redirect to complete page to link or create account
		// Store claims in a temporary cookie for the complete page
		const oidcPendingData = {
			providerId: provider.id,
			providerName: provider.name,
			claims: {
				sub: claims.sub,
				email: claims.email,
				email_verified: claims.email_verified,
				name: claims.name,
				given_name: claims.given_name,
				family_name: claims.family_name
			},
			returnUrl: stateData.returnUrl
		};

		cookies.set('oidc_pending', JSON.stringify(oidcPendingData), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 15 // 15 minutes
		});

		throw redirect(302, '/auth/oidc/complete');
	} catch (e) {
		// Re-throw redirects
		if (e instanceof Response || (e as { status?: number })?.status === 302) {
			throw e;
		}

		console.error('[oidc] Callback error:', e);
		const message = e instanceof Error ? e.message : 'Unknown error';
		throw redirect(302, `/login?error=oidc_error&message=${encodeURIComponent(message)}`);
	}
};
