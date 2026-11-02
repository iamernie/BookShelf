/**
 * Browse preferences for the four list surfaces (My Books, Series, Authors, Narrators).
 *
 * Sort, order, page and limit ride the URL. View lives only in a per-surface cookie, which also
 * supplies sort/order/limit when the URL has none. The server load resolves both, so the first
 * render is already in the saved view and order. Client-safe: no server imports.
 *
 * Cookie: bookshelf-browse-<surface> = <view>.<sort>.<order>.<limit>
 * Every field is checked against this table and falls back alone; an empty field means "default".
 */

export type BrowseSurface = 'books' | 'series' | 'authors' | 'narrators';
export type BrowseView = 'grid' | 'list' | 'series';
export type SortOrder = 'asc' | 'desc';

/** How a field's direction reads in a generated label: text A-Z, dates newest/oldest, numbers high/low */
type FieldKind = 'text' | 'date' | 'number' | 'workflow';

interface SortField {
	label: string;
	kind: FieldKind;
	/** Direction a fresh click or ?sort= alone gets */
	defaultOrder: SortOrder;
}

export interface ListColumn {
	key: string;
	label: string;
	/** Sort key this column's header sorts by; absent = not sortable */
	sort?: string;
	/** Matches the .hide-* rules under the surface's .list-grid-* class in app.css */
	hide?: 'hide-640' | 'hide-900' | 'hide-1200';
}

interface SurfaceConfig {
	views: readonly BrowseView[];
	fields: Record<string, SortField>;
	defaultSort: string;
	/** Dropdown entries; label overrides the generated one */
	options: readonly { sort: string; order: SortOrder; label: string }[];
	limits: readonly number[];
	defaultLimit: number;
	/** List-view columns (entity surfaces; My Books keeps BookListHeader) */
	columns: readonly ListColumn[];
}

const LIMITS = [12, 24, 48, 96] as const;

export const BROWSE_SURFACES: Record<BrowseSurface, SurfaceConfig> = {
	books: {
		views: ['grid', 'series', 'list'],
		fields: {
			createdAt: { label: 'Added', kind: 'date', defaultOrder: 'desc' },
			updatedAt: { label: 'Updated', kind: 'date', defaultOrder: 'desc' },
			title: { label: 'Title', kind: 'text', defaultOrder: 'asc' },
			author: { label: 'Author', kind: 'text', defaultOrder: 'asc' },
			series: { label: 'Series', kind: 'text', defaultOrder: 'asc' },
			status: { label: 'Status', kind: 'workflow', defaultOrder: 'asc' },
			rating: { label: 'Rating', kind: 'number', defaultOrder: 'desc' },
			completedDate: { label: 'Completed', kind: 'date', defaultOrder: 'desc' },
			format: { label: 'Format', kind: 'text', defaultOrder: 'asc' },
			genre: { label: 'Genre', kind: 'text', defaultOrder: 'asc' }
		},
		defaultSort: 'createdAt',
		options: [
			{ sort: 'createdAt', order: 'desc', label: 'Recently Added' },
			{ sort: 'createdAt', order: 'asc', label: 'Oldest Added' },
			{ sort: 'updatedAt', order: 'desc', label: 'Recently Updated' },
			{ sort: 'title', order: 'asc', label: 'Title A-Z' },
			{ sort: 'title', order: 'desc', label: 'Title Z-A' },
			{ sort: 'author', order: 'asc', label: 'Author A-Z' },
			{ sort: 'author', order: 'desc', label: 'Author Z-A' },
			{ sort: 'series', order: 'asc', label: 'Series Order' },
			{ sort: 'status', order: 'asc', label: 'Status' },
			{ sort: 'rating', order: 'desc', label: 'Highest Rated' },
			{ sort: 'rating', order: 'asc', label: 'Lowest Rated' },
			{ sort: 'completedDate', order: 'desc', label: 'Recently Completed' }
		],
		limits: LIMITS,
		defaultLimit: 24,
		columns: []
	},
	series: {
		views: ['grid', 'list'],
		fields: {
			title: { label: 'Title', kind: 'text', defaultOrder: 'asc' },
			author: { label: 'Author', kind: 'text', defaultOrder: 'asc' },
			bookCount: { label: 'Books', kind: 'number', defaultOrder: 'desc' },
			progress: { label: 'Complete', kind: 'number', defaultOrder: 'desc' },
			rating: { label: 'Rating', kind: 'number', defaultOrder: 'desc' },
			createdAt: { label: 'Added', kind: 'date', defaultOrder: 'desc' },
			updatedAt: { label: 'Updated', kind: 'date', defaultOrder: 'desc' }
		},
		defaultSort: 'title',
		options: [
			{ sort: 'title', order: 'asc', label: 'Title A-Z' },
			{ sort: 'title', order: 'desc', label: 'Title Z-A' },
			{ sort: 'author', order: 'asc', label: 'Author A-Z' },
			{ sort: 'bookCount', order: 'desc', label: 'Most Books' },
			{ sort: 'progress', order: 'desc', label: 'Most Complete' },
			{ sort: 'rating', order: 'desc', label: 'Highest Rated' },
			{ sort: 'createdAt', order: 'desc', label: 'Recently Added' },
			{ sort: 'updatedAt', order: 'desc', label: 'Recently Updated' }
		],
		limits: LIMITS,
		defaultLimit: 24,
		columns: [
			{ key: 'title', label: 'Series', sort: 'title' },
			{ key: 'books', label: 'Books', sort: 'bookCount' },
			{ key: 'next', label: 'Next', hide: 'hide-640' },
			{ key: 'rating', label: 'Rating', sort: 'rating', hide: 'hide-900' },
			{ key: 'genre', label: 'Genre', hide: 'hide-900' },
			{ key: 'status', label: 'Status', hide: 'hide-1200' }
		]
	},
	authors: {
		views: ['grid', 'list'],
		fields: {
			name: { label: 'Name', kind: 'text', defaultOrder: 'asc' },
			bookCount: { label: 'Books', kind: 'number', defaultOrder: 'desc' },
			rating: { label: 'Rating', kind: 'number', defaultOrder: 'desc' },
			progress: { label: 'Read', kind: 'number', defaultOrder: 'desc' },
			createdAt: { label: 'Added', kind: 'date', defaultOrder: 'desc' },
			updatedAt: { label: 'Updated', kind: 'date', defaultOrder: 'desc' }
		},
		defaultSort: 'name',
		options: [
			{ sort: 'name', order: 'asc', label: 'Name A-Z' },
			{ sort: 'name', order: 'desc', label: 'Name Z-A' },
			{ sort: 'bookCount', order: 'desc', label: 'Most Books' },
			{ sort: 'rating', order: 'desc', label: 'Highest Rated' },
			{ sort: 'progress', order: 'desc', label: 'Most Complete' },
			{ sort: 'createdAt', order: 'desc', label: 'Recently Added' },
			{ sort: 'updatedAt', order: 'desc', label: 'Recently Updated' }
		],
		limits: LIMITS,
		defaultLimit: 24,
		columns: [
			{ key: 'name', label: 'Name', sort: 'name' },
			{ key: 'books', label: 'Books', sort: 'bookCount' },
			{ key: 'read', label: 'Read', sort: 'progress', hide: 'hide-640' },
			{ key: 'rating', label: 'Rating', sort: 'rating', hide: 'hide-640' },
			{ key: 'genre', label: 'Genre', hide: 'hide-900' },
			{ key: 'tags', label: 'Tags', hide: 'hide-1200' }
		]
	},
	narrators: {
		views: ['grid', 'list'],
		fields: {
			name: { label: 'Name', kind: 'text', defaultOrder: 'asc' },
			bookCount: { label: 'Books', kind: 'number', defaultOrder: 'desc' },
			rating: { label: 'Rating', kind: 'number', defaultOrder: 'desc' },
			createdAt: { label: 'Added', kind: 'date', defaultOrder: 'desc' },
			updatedAt: { label: 'Updated', kind: 'date', defaultOrder: 'desc' }
		},
		defaultSort: 'name',
		options: [
			{ sort: 'name', order: 'asc', label: 'Name A-Z' },
			{ sort: 'name', order: 'desc', label: 'Name Z-A' },
			{ sort: 'bookCount', order: 'desc', label: 'Most Books' },
			{ sort: 'rating', order: 'desc', label: 'Highest Rated' },
			{ sort: 'createdAt', order: 'desc', label: 'Recently Added' },
			{ sort: 'updatedAt', order: 'desc', label: 'Recently Updated' }
		],
		limits: LIMITS,
		defaultLimit: 48,
		columns: [
			{ key: 'name', label: 'Name', sort: 'name' },
			{ key: 'books', label: 'Books', sort: 'bookCount' },
			{ key: 'rating', label: 'Rating', sort: 'rating', hide: 'hide-640' },
			{ key: 'tags', label: 'Tags', hide: 'hide-900' }
		]
	}
};

export interface BrowsePrefs {
	view: BrowseView;
	sort: string;
	order: SortOrder;
	limit: number;
}

export interface ResolvedBrowse extends BrowsePrefs {
	page: number;
}

type CookiePrefs = Partial<BrowsePrefs>;

export function browseCookieName(surface: BrowseSurface): string {
	return `bookshelf-browse-${surface}`;
}

const isOrder = (v: unknown): v is SortOrder => v === 'asc' || v === 'desc';
const isSort = (surface: BrowseSurface, v: unknown): v is string =>
	typeof v === 'string' && Object.hasOwn(BROWSE_SURFACES[surface].fields, v);
const isView = (surface: BrowseSurface, v: unknown): v is BrowseView =>
	typeof v === 'string' && (BROWSE_SURFACES[surface].views as readonly string[]).includes(v);
const isLimit = (surface: BrowseSurface, v: unknown): v is number =>
	typeof v === 'number' && BROWSE_SURFACES[surface].limits.includes(v);

export function defaultOrder(surface: BrowseSurface, sort: string): SortOrder {
	return BROWSE_SURFACES[surface].fields[sort]?.defaultOrder ?? 'asc';
}

/** Only the valid fields of a cookie value; no JSON.parse on cookie input */
export function parseBrowseCookie(surface: BrowseSurface, raw: string | null | undefined): CookiePrefs {
	if (!raw || raw.length > 200) return {};
	const parts = raw.split('.');
	if (parts.length !== 4) return {};
	const [view, sort, order, limit] = parts;
	const out: CookiePrefs = {};
	if (isView(surface, view)) out.view = view;
	// sort and order are a pair: an order without a valid sort means nothing
	if (isSort(surface, sort)) {
		out.sort = sort;
		if (isOrder(order)) out.order = order;
	}
	const n = /^\d{1,3}$/.test(limit) ? Number(limit) : NaN;
	if (isLimit(surface, n)) out.limit = n;
	return out;
}

function serializeBrowseCookie(p: CookiePrefs): string {
	return [p.view ?? '', p.sort ?? '', p.sort ? (p.order ?? '') : '', p.limit ?? ''].join('.');
}

function parsePage(raw: string | null): number {
	const n = raw ? parseInt(raw, 10) : 1;
	return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

/**
 * Effective prefs for a request. Sort and order are a pair: a valid ?sort= takes ?order= or that
 * field's default, never the cookie's order. ?order= alone applies to the cookie (else default) sort.
 * Invalid URL values fall to the cookie, then the default.
 */
export function resolveBrowse(surface: BrowseSurface, params: URLSearchParams, cookie: string | null | undefined): ResolvedBrowse {
	const cfg = BROWSE_SURFACES[surface];
	const saved = parseBrowseCookie(surface, cookie);
	const urlSort = params.get('sort');
	const urlOrder = params.get('order');

	let sort: string;
	let order: SortOrder;
	if (isSort(surface, urlSort)) {
		sort = urlSort;
		order = isOrder(urlOrder) ? urlOrder : defaultOrder(surface, sort);
	} else {
		sort = saved.sort ?? cfg.defaultSort;
		order = isOrder(urlOrder) ? urlOrder : (saved.order ?? defaultOrder(surface, sort));
	}

	const urlLimitRaw = params.get('limit');
	const urlLimit = urlLimitRaw && /^\d{1,3}$/.test(urlLimitRaw) ? Number(urlLimitRaw) : NaN;
	const limit = isLimit(surface, urlLimit) ? urlLimit : (saved.limit ?? cfg.defaultLimit);

	return { view: saved.view ?? 'grid', sort, order, limit, page: parsePage(params.get('page')) };
}

/**
 * Record an explicit choice. Re-reads the cookie and changes only the patched fields, so a shared
 * ?sort= link never becomes the saved sort just because the user toggled the view on it.
 * View writes {view}, sort writes {sort, order}, page size writes {limit}. Call before goto().
 */
export function saveBrowsePrefs(surface: BrowseSurface, patch: Partial<BrowsePrefs>): void {
	if (typeof document === 'undefined') return;
	const name = browseCookieName(surface);
	const current = document.cookie
		.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${name}=`))
		?.slice(name.length + 1);
	const next: CookiePrefs = { ...parseBrowseCookie(surface, current) };
	if (isView(surface, patch.view)) next.view = patch.view;
	if (isSort(surface, patch.sort)) {
		next.sort = patch.sort;
		next.order = isOrder(patch.order) ? patch.order : defaultOrder(surface, patch.sort);
	}
	if (isLimit(surface, patch.limit)) next.limit = patch.limit;
	const secure = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${name}=${serializeBrowseCookie(next)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/** Header click: same field flips, a new field starts at its default direction */
export function nextSort(surface: BrowseSurface, current: { sort: string; order: SortOrder }, field: string): { sort: string; order: SortOrder } {
	if (current.sort === field) return { sort: field, order: current.order === 'asc' ? 'desc' : 'asc' };
	return { sort: field, order: defaultOrder(surface, field) };
}

/** The shared sort handler always writes both params, and a new sort starts at page 1 */
export function applySort(params: URLSearchParams, sort: string, order: SortOrder): void {
	params.set('sort', sort);
	params.set('order', order);
	params.delete('page');
}

function generatedLabel(field: SortField, order: SortOrder): string {
	switch (field.kind) {
		case 'text':
			return `${field.label} ${order === 'asc' ? 'A-Z' : 'Z-A'}`;
		case 'date':
			return `${field.label}: ${order === 'desc' ? 'newest' : 'oldest'}`;
		case 'number':
			return `${field.label}: ${order === 'desc' ? 'highest' : 'lowest'}`;
		case 'workflow':
			return order === 'asc' ? field.label : `${field.label} (reversed)`;
	}
}

/**
 * Dropdown options. When the active combination isn't listed (a header click such as format-asc),
 * it's added with a generated label so the select never goes blank.
 */
export function sortOptions(surface: BrowseSurface, sort: string, order: SortOrder): { value: string; label: string }[] {
	const cfg = BROWSE_SURFACES[surface];
	const opts = cfg.options.map((o) => ({ value: `${o.sort}-${o.order}`, label: o.label }));
	const active = `${sort}-${order}`;
	const field = cfg.fields[sort];
	if (field && !opts.some((o) => o.value === active)) opts.push({ value: active, label: generatedLabel(field, order) });
	return opts;
}

/** Where to send a request whose page is past the end, or null. Keeps every other param. */
export function pastEndRedirect(url: URL, r: { page: number; limit: number; total: number; count: number }): string | null {
	if (r.count > 0 || r.total === 0 || r.page <= 1) return null;
	const params = new URLSearchParams(url.searchParams);
	params.set('page', String(Math.max(1, Math.ceil(r.total / r.limit))));
	return `${url.pathname}?${params.toString()}`;
}
