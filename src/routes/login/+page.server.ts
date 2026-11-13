import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getSetting } from '$lib/server/services/settingsService';
import { getEnabledProviders, getProviderBySlug } from '$lib/server/services/oidcService';
import { resolveLoginPageAccess } from '$lib/server/services/localLoginService';

// Fixed copy for the OIDC codes added in 2.33.0: these never reflect a ?message= value.
// {provider} is the provider's name looked up from ?provider=<slug>, never text from the URL.
const OIDC_ERROR_COPY: Record<string, { named: string; plain: string }> = {
	oidc_group_denied: {
		named: "Your {provider} account doesn't have access to BookShelf. Ask your administrator to add you.",
		plain: "Your account doesn't have access to BookShelf. Ask your administrator to add you."
	},
	oidc_group_unverified: {
		named: "Couldn't confirm your access with {provider}. Try again or contact your administrator.",
		plain: "Couldn't confirm your access with your sign-in provider. Try again or contact your administrator."
	},
	oidc_no_account: {
		named: 'No BookShelf account is linked to this {provider} sign-in. Ask your administrator for access.',
		plain: 'No BookShelf account is linked to this sign-in. Ask your administrator for access.'
	},
	approval_pending: {
		named: 'Your account is pending approval. An administrator will review your registration soon.',
		plain: 'Your account is pending approval. An administrator will review your registration soon.'
	},
	approval_rejected: {
		named: 'Your account registration was not approved. Please contact an administrator for more information.',
		plain: 'Your account registration was not approved. Please contact an administrator for more information.'
	},
	oidc_provision_failed: {
		named: "Couldn't create your account. Try again or contact your administrator.",
		plain: "Couldn't create your account. Try again or contact your administrator."
	},
	link_session_mismatch: {
		named: "That sign-in didn't match your current session. Sign in and try linking again.",
		plain: "That sign-in didn't match your current session. Sign in and try linking again."
	},
	provider_disabled: {
		named: 'This sign-in provider is disabled.',
		plain: 'This sign-in provider is disabled.'
	}
};

// Neutral notices, by code only (no free-text reflection)
const OIDC_NOTICE_COPY: Record<string, string> = {
	approval_pending: 'Account created. An administrator needs to approve it before you can sign in.'
};

// Password sign-in off (2.34.0): an error code outside the table above shows this instead of URL text
const GENERIC_SIGN_IN_ERROR = "Sign-in didn't complete. Try again or contact your administrator.";
const NO_PROVIDER_COPY =
	'Password sign-in is turned off and no single sign-on provider is available. Contact your administrator.';

export const load: PageServerLoad = async ({ locals, url, cookies, request }) => {
	// If already logged in, redirect to home
	if (locals.user) {
		throw redirect(302, '/');
	}

	// Password sign-in switch and the emergency URL (a t= URL always redirects from here)
	const access = await resolveLoginPageAccess(url, cookies, request);

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

	let oidcError: string | null = error ? (errorMessage || error) : null;
	const copy = error && Object.hasOwn(OIDC_ERROR_COPY, error) ? OIDC_ERROR_COPY[error] : null;
	if (copy) {
		const slug = url.searchParams.get('provider');
		const provider = slug && copy.named.includes('{provider}') ? await getProviderBySlug(slug) : null;
		oidcError = provider ? copy.named.replace('{provider}', provider.name) : copy.plain;
	}

	// On the SSO-only page, never echo text from the URL
	if (access.disabled && error && !copy) {
		oidcError = GENERIC_SIGN_IN_ERROR;
	}

	const notice = url.searchParams.get('notice');
	const oidcNotice = notice && Object.hasOwn(OIDC_NOTICE_COPY, notice) ? OIDC_NOTICE_COPY[notice] : null;

	return {
		signupEnabled: allowSignup === 'true',
		oidcProviders,
		oidcError,
		oidcNotice,
		localLogin: {
			formVisible: access.formVisible,
			emergency: access.emergency,
			noProviderMessage: access.disabled && !access.emergency && oidcProviders.length === 0 ? NO_PROVIDER_COPY : null
		}
	};
};
