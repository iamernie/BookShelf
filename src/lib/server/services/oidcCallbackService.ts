import { redirect, isRedirect, type Cookies } from '@sveltejs/kit';
import {
	getProviderById,
	handleCallback,
	findUserByOidc,
	linkAccount,
	updateLastLogin,
	createSessionForUser,
	checkGroupGate,
	provisionOidcUser,
	oidcLoginBlock,
	safeReturnUrl,
	normalizeOidcEmail,
	defaultGroupGateDeps,
	type OidcState,
	type GroupGateDeps,
	type ProvisionDeps
} from './oidcService';
import type { users } from '$lib/server/db';
import type { UserOidcLink } from '$lib/server/db/schema';
import { getSessionCookieOptions, shouldUseSecureCookies } from '$lib/server/utils/cookies';
import { OIDC_PENDING_COOKIE, signPendingCookie } from './oidcPendingCookie';

/**
 * The OIDC callback (/auth/oidc/callback). Branch order after the token exchange:
 * G group gate (inert when requiredGroup is empty) -> L linking request (must match the session)
 * -> E existing link (approval checked) -> A auto-create -> C complete page.
 * The route is a thin wrapper; `deps` is the test seam for the token exchange and userinfo.
 */
export interface OidcCallbackDeps extends GroupGateDeps, ProvisionDeps {
	handleCallback: typeof handleCallback;
}

export const defaultOidcCallbackDeps: OidcCallbackDeps = {
	handleCallback,
	fetchUserInfo: defaultGroupGateDeps.fetchUserInfo
};

export interface OidcCallbackInput {
	url: URL;
	cookies: Cookies;
	locals: { user?: { id: number } | null };
	baseUrl: string;
}

export async function runOidcCallback(
	{ url, cookies, locals, baseUrl }: OidcCallbackInput,
	deps: OidcCallbackDeps = defaultOidcCallbackDeps
): Promise<never> {
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
	// The state cookie is unsigned, so a disabled provider must be refused here too, not only
	// when the flow starts
	if (!provider.enabled) {
		throw redirect(302, '/login?error=provider_disabled');
	}

	// Build redirect URI (must match what was sent in authorization request)
	const redirectUri = `${baseUrl}/auth/oidc/callback`;

	// Build the full callback URL that openid-client v6 needs
	// It extracts the code and state from the URL's query parameters
	const callbackUrl = new URL(url.pathname + url.search, baseUrl);

	const providerParam = `provider=${encodeURIComponent(provider.slug)}`;
	const isLinking = !!stateData.linkingUserId;

	const startSession = async (user: typeof users.$inferSelect): Promise<never> => {
		const { sessionId } = await createSessionForUser(user, provider.id);
		cookies.set('session', sessionId, getSessionCookieOptions());
		throw redirect(302, safeReturnUrl(stateData.returnUrl));
	};

	const loginLinked = async (found: { user: typeof users.$inferSelect; link: UserOidcLink }): Promise<never> => {
		const block = oidcLoginBlock(found.user);
		if (block) {
			throw redirect(302, `/login?error=${block}`);
		}
		await updateLastLogin(found.link.id);
		return startSession(found.user);
	};

	try {
		// Exchange code for tokens and get user claims
		const tokenResult = await deps.handleCallback(provider, callbackUrl, redirectUri, stateData.nonce, stateData.state);
		const { claims } = tokenResult;

		// G. Group gate: before everything else, linking included
		const gate = await checkGroupGate(provider, tokenResult, deps);
		if (!gate.allowed) {
			const errorCode = gate.reason === 'userinfo_failed' ? 'oidc_group_unverified' : 'oidc_group_denied';
			if (isLinking && locals.user) {
				throw redirect(302, `/account/settings?error=${errorCode}&${providerParam}`);
			}
			throw redirect(302, `/login?error=${errorCode}&${providerParam}`);
		}

		// Check if this OIDC identity is already linked to a user
		const existingLink = await findUserByOidc(provider.id, claims.sub);

		// L. Account linking request: only for the user who is signed in right now
		if (stateData.linkingUserId) {
			if (!locals.user || locals.user.id !== stateData.linkingUserId) {
				console.warn(`[oidc] linking refused: state user does not match the session provider=${provider.id}`);
				throw redirect(
					302,
					locals.user ? '/account/settings?error=link_session_mismatch' : '/login?error=link_session_mismatch'
				);
			}
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

		// E. Not a linking request - this is a login attempt
		if (existingLink) {
			return await loginLinked(existingLink);
		}

		// A. Auto-create
		if (provider.autoCreateUsers) {
			let result: Awaited<ReturnType<typeof provisionOidcUser>>;
			try {
				result = await provisionOidcUser(provider, claims, deps);
			} catch (e) {
				console.error(`[oidc] auto-create failed provider=${provider.id} sub=${claims.sub}:`, e);
				throw redirect(302, '/login?error=oidc_provision_failed');
			}
			if (result.kind === 'linked') {
				return await loginLinked(result.found);
			}
			if (result.kind === 'created') {
				console.log(`[oidc] auto-created user ${result.user.id} provider=${provider.id}`);
				if (oidcLoginBlock(result.user)) {
					throw redirect(302, '/login?notice=approval_pending');
				}
				return await startSession(result.user);
			}
			// email_taken: never adopt an existing account; the complete page offers link-by-password
		}

		// C. New OIDC user - redirect to complete page to link or create account
		// Store claims in a temporary cookie for the complete page
		const oidcPendingData = {
			providerId: provider.id,
			providerName: provider.name,
			claims: {
				sub: claims.sub,
				// Lowercased so the complete page's exact-case lookup finds the account
				email: normalizeOidcEmail(claims.email),
				email_verified: claims.email_verified,
				name: claims.name,
				given_name: claims.given_name,
				family_name: claims.family_name
			},
			returnUrl: stateData.returnUrl
		};

		// Signed (2.34.0): the complete page only trusts an identity this callback vouched for
		cookies.set(OIDC_PENDING_COOKIE, signPendingCookie(JSON.stringify(oidcPendingData)), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: shouldUseSecureCookies(),
			maxAge: 60 * 15 // 15 minutes
		});

		throw redirect(302, '/auth/oidc/complete');
	} catch (e) {
		// Re-throw every redirect, whatever its status
		if (isRedirect(e)) {
			throw e;
		}

		console.error('[oidc] Callback error:', e);
		const message = e instanceof Error ? e.message : 'Unknown error';
		throw redirect(302, `/login?error=oidc_error&message=${encodeURIComponent(message)}`);
	}
}
