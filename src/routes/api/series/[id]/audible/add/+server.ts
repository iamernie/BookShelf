/**
 * POST /api/series/[id]/audible/add  { asin }
 *   201 { created: true, book: { id, title }, statusApplied } - added to the user's library
 *   200 { created: false, book: { id, title } } - the user already has it
 *   404 - the ASIN isn't in this series' saved Audible list, or the viewer can't see the series
 *   400 for a missing asin or any other body field: everything else comes from the saved list
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addSuggestion } from '$lib/server/services/audibleSuggestService';
import { hasPermission, Permission } from '$lib/server/services/permissionService';
import { canReachEntity } from '$lib/server/services/libraryShareService';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	if (!hasPermission(locals.user, Permission.ADD_BOOKS)) {
		throw error(403, { message: 'You do not have permission to add books' });
	}
	if (!/^\d+$/.test(params.id)) {
		throw error(400, { message: 'Invalid series ID' });
	}

	let body: unknown;
	try {
		body = JSON.parse(await request.text());
	} catch {
		return json({ message: 'Invalid JSON body' }, { status: 400 });
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ message: 'Body must be { "asin": "..." }' }, { status: 400 });
	}
	const unknown = Object.keys(body).filter((k) => k !== 'asin');
	if (unknown.length > 0) {
		return json({ message: `Unknown field: ${unknown.join(', ')}. Only "asin" is accepted.` }, { status: 400 });
	}
	const asin = (body as { asin?: unknown }).asin;
	if (typeof asin !== 'string' || !asin.trim()) {
		return json({ message: 'asin is required' }, { status: 400 });
	}

	if (!(await canReachEntity(locals.user, 'series', Number(params.id)))) {
		throw error(404, { message: 'Series not found' });
	}

	const result = await addSuggestion(locals.user.id, Number(params.id), asin);
	if (!result.ok) {
		return json({ message: result.message }, { status: result.status });
	}
	if (result.created) {
		return json({ created: true, book: result.book, statusApplied: result.statusApplied }, { status: 201 });
	}
	return json({ created: false, book: result.book });
};
