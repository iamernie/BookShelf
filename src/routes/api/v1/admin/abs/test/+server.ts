/**
 * POST /api/v1/admin/abs/test - Test the Audiobookshelf connection (admin only)
 *
 * Body (optional): { baseUrl?: string, apiKey?: string } to test unsaved values;
 * omitted fields fall back to the stored settings.
 * Returns { ok: true, libraries: n, libraryName } or { ok: false, error }.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { testAbsConnection } from '$lib/server/services/absService';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const body: { baseUrl?: unknown; apiKey?: unknown } = await request.json().catch(() => ({}));
	const result = await testAbsConnection({
		baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
		apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined
	});

	return json(result);
};
