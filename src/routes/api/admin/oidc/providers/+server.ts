import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProviders,
	createProvider,
	testProviderConnection,
	generateSlug,
	isSlugUnique,
	PROVIDER_PRESETS
} from '$lib/server/services/oidcService';

// GET /api/admin/oidc/providers - List all providers
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const providers = await getProviders();

	// Mask secrets for security
	const maskedProviders = providers.map((p) => ({
		...p,
		clientSecret: p.clientSecret ? '••••••••' : ''
	}));

	return json({
		providers: maskedProviders,
		presets: PROVIDER_PRESETS
	});
};

// POST /api/admin/oidc/providers - Create new provider
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const data = await request.json();

	// Validate required fields
	if (!data.name || !data.issuerUrl || !data.clientId || !data.clientSecret) {
		throw error(400, 'Missing required fields: name, issuerUrl, clientId, clientSecret');
	}

	// Generate slug from name if not provided
	let slug = data.slug || generateSlug(data.name);

	// Ensure slug is unique
	if (!(await isSlugUnique(slug))) {
		// Append a number to make it unique
		let counter = 1;
		while (!(await isSlugUnique(`${slug}-${counter}`))) {
			counter++;
		}
		slug = `${slug}-${counter}`;
	}

	// Test connection before saving
	const testResult = await testProviderConnection(data.issuerUrl, data.clientId, data.clientSecret);
	if (!testResult.success) {
		return json(
			{
				success: false,
				error: testResult.error,
				validationFailed: true
			},
			{ status: 400 }
		);
	}

	try {
		const provider = await createProvider({
			name: data.name,
			slug,
			issuerUrl: data.issuerUrl,
			clientId: data.clientId,
			clientSecret: data.clientSecret,
			scopes: data.scopes || '["openid", "profile", "email"]',
			enabled: data.enabled ?? true,
			autoCreateUsers: data.autoCreateUsers ?? false,
			defaultRole: data.defaultRole || 'member',
			iconUrl: data.iconUrl || null,
			buttonColor: data.buttonColor || null,
			displayOrder: data.displayOrder ?? 0
		});

		return json({
			success: true,
			provider: {
				...provider,
				clientSecret: '••••••••'
			}
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to create provider';
		throw error(500, message);
	}
};
