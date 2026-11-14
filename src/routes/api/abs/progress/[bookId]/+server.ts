/**
 * GET /api/abs/progress/{bookId} - the signed-in user's own listening progress on a book (2.36.0)
 *
 * Only for a book in the user's library (holdsBook), through their own Audiobookshelf connection.
 * 404 with no detail for every "no": no such book, not in their library, not linked, no connection,
 * no progress. 502 when Audiobookshelf fails.
 */

import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';
import { holdsBook } from '$lib/server/services/libraryShareService';
import { getAbsProgressForUser } from '$lib/server/services/absConnectionService';

const NONE = () => json({ ok: false, hasProgress: false }, { status: 404 });

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role === 'guest') return NONE();
	const bookId = Number(params.bookId);
	if (!Number.isInteger(bookId) || bookId <= 0) return NONE();
	if (!(await holdsBook(locals.user.id, bookId))) return NONE();

	const [book] = await db.select({ absItemId: books.absItemId }).from(books).where(eq(books.id, bookId)).limit(1);
	if (!book?.absItemId) return NONE();

	try {
		const { progress } = await getAbsProgressForUser(locals.user.id, book.absItemId);
		return progress ? json({ ok: true, progress }) : NONE();
	} catch (err) {
		return json({ ok: false, error: err instanceof Error ? err.message : 'Audiobookshelf request failed' }, { status: 502 });
	}
};
