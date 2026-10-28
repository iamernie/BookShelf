/**
 * POST /api/admin/abs/attention/[id] - Resolve one attention item (admin only)
 *
 * Body, one of:
 *   { action: 'link', bookId }  - link the item to this book (409 if either side is linked elsewhere)
 *   { action: 'create' }        - create a born-linked book, as the sync would
 *   { action: 'keep', bookId }  - duplicate link: keep this book, unlink the others
 *   { action: 'ignore' }        - later runs skip the item
 *   { action: 'reopen' }        - undo ignore (a deleted book's tombstone is removed instead)
 * 200 { item, book? }; 400 bad body; 404; 409; 503 while sync is off or not configured.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyAttentionAction, type AttentionAction } from '$lib/server/services/absAttentionService';

function parseAction(body: unknown): AttentionAction | null {
	if (!body || typeof body !== 'object') return null;
	const { action, bookId } = body as { action?: unknown; bookId?: unknown };
	if (action === 'create' || action === 'ignore' || action === 'reopen') return { action };
	if ((action === 'link' || action === 'keep') && Number.isInteger(bookId)) return { action, bookId: bookId as number };
	return null;
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ message: 'Admin access required' }, { status: 403 });
	}

	const id = parseInt(params.id, 10);
	if (!Number.isInteger(id)) return json({ message: 'Invalid attention ID' }, { status: 400 });

	const action = parseAction(await request.json().catch(() => null));
	if (!action) {
		return json({ message: 'action must be link (with bookId), keep (with bookId), create, ignore or reopen' }, { status: 400 });
	}

	const result = await applyAttentionAction(id, action, locals.user.id);
	if (!result.ok) return json({ message: result.message }, { status: result.status });
	return json(result.book ? { item: result.item, book: result.book } : { item: result.item });
};
