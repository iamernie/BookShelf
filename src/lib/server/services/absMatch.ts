/**
 * Audiobookshelf item → BookShelf book matching (pure: no database, no network)
 *
 * The title rules are a line-by-line port of the external pipeline script
 * (audible_to_bookshelf.py: _norm_title, the clean/core/base title forms, _tmatch,
 * _amatch, _split_names) so the app links exactly what the script used to.
 * Differences from the script are marked "v2:".
 *
 * Tiers, first tier with any hit decides:
 *   asin  - ASIN equality (any format)
 *   isbn  - ISBN-13 equality, ISBN-10 converted (any format)
 *   title - cleaned title (audio-format books only)
 *   core  - title before the first ': ' / ' - ' (audio only, author must agree)
 *   base  - title without a trailing book number (audio only, author must agree)
 *   then the script's prefix containment over the same forms, which only ever queues
 * One unlinked hit links; several queue for a human; hits that are all linked elsewhere skip.
 */

import { duplicateNameKey } from '$lib/server/utils/nameNormalization';

export type MatchTier = 'asin' | 'isbn' | 'title' | 'core' | 'base';

export interface MatchBook {
	id: number;
	title: string;
	asin: string | null;
	isbn10: string | null;
	isbn13: string | null;
	absItemId: string | null;
	isAudio: boolean;
	formatName: string | null;
	/** Author names in display order (from bookauthors) */
	authors: string[];
}

export interface MatchItem {
	id: string;
	title: string;
	asin: string | null;
	isbn: string | null;
	/** Author names as ABS gives them (array names, or the comma-joined authorName split) */
	authors: string[];
	/** Raw authorName string when ABS sent one (the script matched on this) */
	authorName: string | null;
}

export interface MatchCandidate {
	bookId: number;
	title: string;
	author: string | null;
	formatName: string | null;
	tier: MatchTier;
	linkedTo: string | null;
}

export type MatchResult =
	| { kind: 'link'; tier: MatchTier; bookId: number; candidates: MatchCandidate[] }
	| { kind: 'queue'; tier: MatchTier; reason: 'several_candidates' | 'author_mismatch' | 'prefix_only'; candidates: MatchCandidate[] }
	| { kind: 'skip'; tier: MatchTier; reason: 'matches_linked_book'; candidates: MatchCandidate[] }
	| { kind: 'create'; note: 'non_audio_title_match' | null; candidates: MatchCandidate[] };

// ============================================
// Title forms (ported from the script)
// ============================================

/**
 * _norm_title: lowercase, drop ' (unabridged)' / ' (abridged)', strip . , : - and ALL
 * whitespace, so 'A.I. Battle Station' and 'AI Battle Station' compare equal.
 */
export function normTitle(s: string | null | undefined): string {
	let t = (s ?? '').toLowerCase().trim();
	for (const suffix of [' (unabridged)', ' (abridged)']) t = t.split(suffix).join('');
	t = t.replace(/[.,:-]/g, '');
	return t.replace(/\s+/g, '').trim();
}

/** clean_title: the ABS title without a trailing '(Unabridged)' / '(Abridged)' */
export function cleanTitle(title: string): string {
	return title.replace(/\s*\((Unabridged|Abridged)\)\s*$/, '').trim() || title;
}

/** core: the part before the first ':' or '-' that is followed by whitespace */
export function coreTitle(clean: string): string {
	const m = /\s*[:-]\s+/.exec(clean);
	return (m ? clean.slice(0, m.index) : clean).trim();
}

/** base: the title without a trailing book number ('Able Bodied Soldier 1' -> 'Able Bodied Soldier') */
export function baseTitle(clean: string): string {
	return clean.replace(/[\s-]+\d+(\.\d+)?\s*$/, '').trim();
}

/** _tmatch: equal after normalization, or one a prefix of the other */
export function titleMatches(a: string | null | undefined, b: string | null | undefined): boolean {
	const na = normTitle(a);
	const nb = normTitle(b);
	return !!na && !!nb && (na === nb || na.startsWith(nb) || nb.startsWith(na));
}

function titleExact(a: string | null | undefined, b: string | null | undefined): boolean {
	const na = normTitle(a);
	return !!na && na === normTitle(b);
}

// ============================================
// People
// ============================================

/**
 * _split_names: ABS hands multi-author strings comma-joined; split into names.
 * Any one-letter fragment means the commas weren't separators: keep the whole string.
 */
export function splitNames(s: string | null | undefined): string[] {
	if (!s) return [];
	const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
	const whole = s.trim();
	if (parts.length === 0 || parts.some((p) => p.length < 2)) {
		return /[A-Za-z]/.test(whole) ? [whole] : [];
	}
	return parts;
}

/** Name key for authors/narrators: 'J.N. Chaney', 'J. N. Chaney', 'JN Chaney' -> 'jnchaney' */
export function nameKey(name: string): string {
	return duplicateNameKey(name);
}

/**
 * _amatch with the app's name key: some item author equals, or is a prefix of / prefixed by,
 * some book author. The whole authorName string is tried too, as the script did.
 */
export function authorsAgree(item: Pick<MatchItem, 'authors' | 'authorName'>, bookAuthors: string[]): boolean {
	const itemKeys = [...item.authors, ...(item.authorName ? [item.authorName] : [])].map(nameKey).filter(Boolean);
	if (itemKeys.length === 0) return false;
	for (const a of bookAuthors) {
		const n = nameKey(a);
		if (!n) continue;
		if (itemKeys.some((k) => k === n || k.startsWith(n) || n.startsWith(k))) return true;
	}
	return false;
}

// ============================================
// Identifiers
// ============================================

export function normalizeAsin(asin: string | null | undefined): string | null {
	const a = (asin ?? '').trim().toUpperCase();
	return a || null;
}

/** ISBN-10 or ISBN-13 (hyphens/spaces allowed) -> ISBN-13 digits; null when it isn't one */
export function normalizeIsbn(isbn: string | null | undefined): string | null {
	const raw = (isbn ?? '').replace(/[\s-]/g, '').toUpperCase();
	if (/^\d{13}$/.test(raw)) return raw;
	if (/^\d{9}[\dX]$/.test(raw)) {
		const core = '978' + raw.slice(0, 9);
		let sum = 0;
		for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
		return core + String((10 - (sum % 10)) % 10);
	}
	return null;
}

// ============================================
// Index + matching
// ============================================

export interface MatchIndex {
	books: MatchBook[];
	byAsin: Map<string, MatchBook[]>;
	byIsbn: Map<string, MatchBook[]>;
	audio: MatchBook[];
}

function push<K>(map: Map<K, MatchBook[]>, key: K, book: MatchBook) {
	const list = map.get(key);
	if (list) list.push(book);
	else map.set(key, [book]);
}

export function buildMatchIndex(books: MatchBook[]): MatchIndex {
	const byAsin = new Map<string, MatchBook[]>();
	const byIsbn = new Map<string, MatchBook[]>();
	for (const b of books) {
		const asin = normalizeAsin(b.asin);
		if (asin) push(byAsin, asin, b);
		const isbns = new Set([normalizeIsbn(b.isbn13), normalizeIsbn(b.isbn10)].filter((x): x is string => !!x));
		for (const isbn of isbns) push(byIsbn, isbn, b);
	}
	return { books, byAsin, byIsbn, audio: books.filter((b) => b.isAudio) };
}

/** Add a book created or linked during the run, so later items in the same scan see it. */
export function addToMatchIndex(index: MatchIndex, book: MatchBook): void {
	index.books.push(book);
	const asin = normalizeAsin(book.asin);
	if (asin) push(index.byAsin, asin, book);
	const isbn = normalizeIsbn(book.isbn13) ?? normalizeIsbn(book.isbn10);
	if (isbn) push(index.byIsbn, isbn, book);
	if (book.isAudio) index.audio.push(book);
}

function toCandidate(b: MatchBook, tier: MatchTier): MatchCandidate {
	return { bookId: b.id, title: b.title, author: b.authors[0] ?? null, formatName: b.formatName, tier, linkedTo: b.absItemId };
}

/** One tier's hits -> a decision (link / queue / skip) */
function decide(hits: MatchBook[], tier: MatchTier): MatchResult {
	const unique = [...new Map(hits.map((b) => [b.id, b])).values()].sort((a, b) => a.id - b.id);
	const candidates = unique.map((b) => toCandidate(b, tier));
	// Books linked to some other item belong to that item
	const unlinked = unique.filter((b) => !b.absItemId);
	if (unlinked.length === 0) return { kind: 'skip', tier, reason: 'matches_linked_book', candidates };
	if (unlinked.length === 1) return { kind: 'link', tier, bookId: unlinked[0].id, candidates };
	// v2: the script linked the first unlinked copy here (the Quantum Assault failure); a human picks instead
	return { kind: 'queue', tier, reason: 'several_candidates', candidates: unlinked.map((b) => toCandidate(b, tier)) };
}

/**
 * Decide what to do with one ABS item that isn't linked to any book.
 * The caller has already skipped linked, ignored and queued items.
 *
 * v2 title order: exact normalized equality on every form first (title, then core and base with
 * author agreement), then the script's prefix containment. The script linked prefix hits directly
 * at the title tier with no author check, so 'Lone Star: A Tale' (another author) linked to
 * 'Lone Star' and 'Dune Messiah' to 'Dune'; here a prefix-only hit is queued for a human, and only
 * when the author agrees (or the item has no author to compare).
 */
export function matchItem(item: MatchItem, index: MatchIndex): MatchResult {
	const asin = normalizeAsin(item.asin);
	if (asin) {
		const hits = index.byAsin.get(asin);
		if (hits?.length) return decide(hits, 'asin');
	}

	const isbn = normalizeIsbn(item.isbn);
	if (isbn) {
		const hits = index.byIsbn.get(isbn);
		if (hits?.length) return decide(hits, 'isbn');
	}

	const clean = cleanTitle(item.title);
	const core = coreTitle(clean);
	const base = baseTitle(clean);
	const forms: [MatchTier, string][] = [['title', clean]];
	if (core && core !== clean) forms.push(['core', core]);
	if (base && base !== clean && base !== core) forms.push(['base', base]);

	// 1. Exact. The cleaned title decides on its own: a same-title book linked to another item
	//    means this is a second copy of that audiobook, so it is skipped (never re-created).
	//    Core/base forms only consider unlinked books (a linked 'Soldier' must not swallow
	//    'Soldier 2') and need the author to agree.
	for (const [tier, form] of forms) {
		if (tier === 'title') {
			const hits = index.audio.filter((b) => titleExact(b.title, form));
			if (hits.length) return decide(hits, tier);
			continue;
		}
		const hits = index.audio.filter((b) => !b.absItemId && titleExact(b.title, form));
		if (hits.length === 0) continue;
		const agreeing = hits.filter((b) => authorsAgree(item, b.authors));
		if (agreeing.length) return decide(agreeing, tier);
		// v2: a title-only hit with another author is queued, not created as a likely duplicate
		return { kind: 'queue', tier, reason: 'author_mismatch', candidates: hits.map((b) => toCandidate(b, tier)) };
	}

	// 2. Prefix containment (_tmatch) against unlinked books: never links on its own.
	//    v2: the script's base-tier prefix hit a linked 'Brand New 0' for 'Brand New 1' and skipped it forever.
	const hasAuthor = item.authors.length > 0 || !!item.authorName;
	for (const [tier, form] of forms) {
		const hits = index.audio.filter((b) => !b.absItemId && titleMatches(b.title, form) && (!hasAuthor || authorsAgree(item, b.authors)));
		if (hits.length === 0) continue;
		return { kind: 'queue', tier, reason: 'prefix_only', candidates: [...new Map(hits.map((b) => [b.id, toCandidate(b, tier)])).values()] };
	}

	// Title tiers only link audio records; a same-title ebook gets a separate audio record
	const nonAudio = index.books.filter((b) => !b.isAudio && titleExact(b.title, clean));
	return {
		kind: 'create',
		note: nonAudio.length ? 'non_audio_title_match' : null,
		candidates: nonAudio.map((b) => toCandidate(b, 'title'))
	};
}

/** Series sequence the script sent: '3', '2.5', or '1-3' for a range; null when unnumbered */
export function seriesSequence(bookNum: number | null | undefined, bookNumEnd: number | null | undefined): string | null {
	if (!bookNum) return null;
	return bookNumEnd ? `${bookNum}-${bookNumEnd}` : String(bookNum);
}
