/**
 * GET /api/v1/admin/abs/search?q=<title>&limit=20 - Search the Audiobookshelf library (admin only)
 *
 * Proxies the ABS library search for manual linking.
 * Returns [{ id, title, authorName, narratorName, asin }] or { message } on failure.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchAbsItems } from '$lib/server/services/absService';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const q = url.searchParams.get('q') ?? '';
	const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

	try {
		return json(await searchAbsItems(q, limit));
	} catch (err) {
		return json({ message: err instanceof Error ? err.message : 'Audiobookshelf search failed' }, { status: 502 });
	}
};
