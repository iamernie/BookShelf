/**
 * Book edit saves in two halves (2.30.0). Personal fields are the viewer's own reading record and
 * only need the book to be reachable; catalog fields go through the catalog permission gate. Sent
 * apart, an owner of a promoted book (or any member) saves their own rating, notes and status even
 * when the catalog half is refused.
 */

/** Book-body keys that are the viewer's own state, as PUT /api/books/[id] reads them */
export const PERSONAL_BODY_KEYS = ['rating', 'comments', 'statusId', 'startReadingDate', 'completedDate', 'dnfPage', 'dnfPercent', 'dnfReason', 'dnfDate'] as const;

export function splitBookBody<T extends Record<string, unknown>>(body: T): { personal: Partial<T>; catalog: Partial<T> } {
	const personal: Partial<T> = {};
	const catalog: Partial<T> = {};
	for (const [key, value] of Object.entries(body) as [keyof T & string, T[keyof T & string]][]) {
		if ((PERSONAL_BODY_KEYS as readonly string[]).includes(key)) personal[key] = value;
		else catalog[key] = value;
	}
	return { personal, catalog };
}

export type BookSaveResult = { ok: true } | { ok: false; personalSaved: boolean; message: string };

async function put(bookId: number, body: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
	const res = await fetch(`/api/books/${bookId}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (res.ok) return { ok: true, message: '' };
	let message = `HTTP ${res.status}`;
	try {
		message = ((await res.json()) as { message?: string } | null)?.message || message;
	} catch {
		// non-JSON error body
	}
	return { ok: false, message };
}

/**
 * Save the halves that changed since `saved` (the last saved split, compared by value): personal
 * first, then catalog. An unchanged half is not sent, so a viewer who can't edit the catalog
 * never trips its gate by saving their notes.
 */
export async function saveBookEdits<T extends Record<string, unknown>>(
	bookId: number,
	body: T,
	saved: { personal: Partial<T>; catalog: Partial<T> }
): Promise<BookSaveResult> {
	const { personal, catalog } = splitBookBody(body);
	const personalChanged = JSON.stringify(personal) !== JSON.stringify(saved.personal);
	const catalogChanged = JSON.stringify(catalog) !== JSON.stringify(saved.catalog);
	let personalSaved = false;
	if (personalChanged) {
		const r = await put(bookId, personal);
		if (!r.ok) return { ok: false, personalSaved: false, message: r.message };
		personalSaved = true;
	}
	if (catalogChanged) {
		const r = await put(bookId, catalog);
		if (!r.ok) return { ok: false, personalSaved, message: r.message };
	}
	return { ok: true };
}
