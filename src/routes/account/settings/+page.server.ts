import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserPreferences } from '$lib/server/services/userPreferencesService';
import { getUserOidcLinks, getEnabledProviders, getProviderBySlug } from '$lib/server/services/oidcService';
import { getLibraryShares, getSharedLibraries, getShareableUsers } from '$lib/server/services/libraryShareService';
import { isNtfyEnabled } from '$lib/server/services/notificationService';
import { getAbsLinkBaseUrl } from '$lib/server/services/absService';
import { getConnection, getSyncCadence, getUnplacedCount, toConnectionView } from '$lib/server/services/absConnectionService';
import { secretBoxRefusal } from '$lib/server/services/secretBox';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const preferences = await getUserPreferences(locals.user.id);

	// Get user's OIDC linked accounts
	const oidcLinks = await getUserOidcLinks(locals.user.id);

	// Get available providers for linking
	const allProviders = await getEnabledProviders();

	// Filter out already-linked providers
	const linkedProviderIds = new Set(oidcLinks.map((l) => l.providerId));
	const availableProviders = allProviders.filter((p) => !linkedProviderIds.has(p.id));

	// Check for linking status from callback
	const linkedParam = url.searchParams.get('linked');
	const errorParam = url.searchParams.get('error');

	// Linking refusals are codes mapped to fixed copy; the provider name comes from the DB
	let linkingError: string | null = null;
	if (errorParam === 'already_linked') {
		linkingError = 'This identity is already linked to another account';
	} else if (errorParam === 'oidc_group_denied' || errorParam === 'oidc_group_unverified') {
		const slug = url.searchParams.get('provider');
		const provider = slug ? await getProviderBySlug(slug) : null;
		linkingError =
			errorParam === 'oidc_group_denied'
				? `That ${provider?.name ?? 'sign-in'} account doesn't have access to BookShelf.`
				: `Couldn't confirm your access with ${provider?.name ?? 'your sign-in provider'}. Try again or contact your administrator.`;
	} else if (errorParam === 'link_session_mismatch') {
		linkingError = "That sign-in didn't match your current session. Try linking again.";
	}

	const linkingStatus = {
		justLinked: linkedParam === 'true',
		alreadyLinked: linkedParam === 'already',
		error: linkingError
	};

	// Get library sharing data and ntfy status
	const [myShares, sharedWithMe, shareableUsers, ntfyEnabled, absBaseUrl] = await Promise.all([
		getLibraryShares(locals.user.id),
		getSharedLibraries(locals.user.id),
		getShareableUsers(locals.user.id),
		isNtfyEnabled(),
		getAbsLinkBaseUrl()
	]);

	// Audiobookshelf card (2.36.0): every role but guest, only when the admin has set ABS up
	let absCard = null;
	if (absBaseUrl && locals.user.role !== 'guest') {
		const [conn, cadence, unplaced] = await Promise.all([
			getConnection(locals.user.id),
			getSyncCadence(),
			getUnplacedCount(locals.user.id)
		]);
		absCard = {
			available: true,
			baseUrl: absBaseUrl,
			secretAvailable: secretBoxRefusal() === null,
			connection: toConnectionView(conn),
			cadence,
			unplaced
		};
	}

	return {
		preferences,
		oidcLinks: oidcLinks.map((link) => ({
			id: link.id,
			providerId: link.providerId,
			providerName: link.provider.name,
			providerSlug: link.provider.slug,
			providerColor: link.provider.buttonColor,
			providerIcon: link.provider.iconUrl,
			linkedAt: link.linkedAt,
			lastLoginAt: link.lastLoginAt,
			oidcEmail: link.oidcEmail
		})),
		availableProviders: availableProviders.map((p) => ({
			id: p.id,
			slug: p.slug,
			name: p.name,
			buttonColor: p.buttonColor,
			iconUrl: p.iconUrl
		})),
		justLinked: linkingStatus.justLinked,
		alreadyLinked: linkingStatus.alreadyLinked,
		linkingError: linkingStatus.error,
		librarySharing: {
			myShares,
			sharedWithMe,
			shareableUsers
		},
		ntfyEnabled,
		absCard
	};
};
