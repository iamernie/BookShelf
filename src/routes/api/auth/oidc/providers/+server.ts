import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEnabledProviders } from '$lib/server/services/oidcService';

// GET /api/auth/oidc/providers - List enabled OIDC providers for login page
export const GET: RequestHandler = async () => {
	const providers = await getEnabledProviders();

	// Return only public info (no secrets)
	const publicProviders = providers.map((p) => ({
		slug: p.slug,
		name: p.name,
		iconUrl: p.iconUrl,
		buttonColor: p.buttonColor
	}));

	return json({ providers: publicProviders });
};
