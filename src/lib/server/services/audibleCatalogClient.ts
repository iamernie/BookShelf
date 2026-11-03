/**
 * Audible catalog client for series suggestions (2.27.0)
 *
 * Public catalog API, no auth, audible.com only (metadata.audible_domain is not used, same as
 * the metadata provider). One client per refresh run: it paces every request, retries network
 * errors / 5xx / 429, counts every attempt (retries included) against the run's request budget,
 * and opens a circuit after consecutive failed requests.
 *
 * The base URL comes from the operator env AUDIBLE_CATALOG_URL (never a setting or the API);
 * the test harness points it at a local mock.
 */

import { env } from '$env/dynamic/private';
import { USER_AGENT, type AudibleProduct } from './metadataProviders/audibleProvider';

export type { AudibleProduct } from './metadataProviders/audibleProvider';

const DEFAULT_BASE_URL = 'https://api.audible.com/1.0/catalog/products';
const PRODUCT_GROUPS = 'product_desc,product_attrs,contributors,series,media';
const REQUEST_TIMEOUT_MS = 15_000;

export const DELAY_MS = 1500;
const JITTER_MS = 500;
const BACKOFF_MS = [2000, 4000];
const MAX_TRIES = 3;
export const MAX_REQUESTS_PER_RUN = 150;
export const CIRCUIT_AFTER_FAILURES = 5;
export const BATCH_SIZE = 25;

/** The run's request budget is spent; the series in hand is left untouched */
export class CatalogBudgetExhausted extends Error {
	constructor() {
		super('Audible request budget for this run is used up');
	}
}

/** Too many requests in a row failed; the run stops */
export class CatalogUnavailable extends Error {
	constructor(last: string) {
		super(`Audible is not responding (${CIRCUIT_AFTER_FAILURES} requests in a row failed; last: ${last})`);
	}
}

/** One request failed after its retries */
export class CatalogRequestError extends Error {
	constructor(message: string, readonly status: number | null) {
		super(message);
	}
}

// ============================================
// Test hooks (the harness swaps the transport and the waits)
// ============================================

interface CatalogTestHooks {
	transport?: typeof fetch;
	delayMs?: number;
	jitterMs?: number;
	backoffMs?: number[];
}

const HOOKS_KEY = Symbol.for('bookshelf.audibleCatalogHooks');
type HooksGlobal = typeof globalThis & { [HOOKS_KEY]?: CatalogTestHooks };

export function __setCatalogTestHooks(hooks: CatalogTestHooks | null): void {
	(globalThis as HooksGlobal)[HOOKS_KEY] = hooks ?? undefined;
}

function hooks(): CatalogTestHooks {
	return (globalThis as HooksGlobal)[HOOKS_KEY] ?? {};
}

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

// ============================================
// Sequences
// ============================================

export interface ParsedSequence {
	value: number | null;
	end: number | null;
}

/** "3.5" -> 3.5; "1-10" -> 1 to 10; "", "abc" or anything else -> null. Never throws. */
export function parseSequence(raw: string | null | undefined): ParsedSequence {
	const m = /^\s*(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*$/.exec(raw ?? '');
	if (!m) return { value: null, end: null };
	const value = parseFloat(m[1]);
	const end = m[2] !== undefined ? parseFloat(m[2]) : null;
	if (!Number.isFinite(value)) return { value: null, end: null };
	return { value, end: end !== null && Number.isFinite(end) && end > value ? end : null };
}

// ============================================
// Response shapes
// ============================================

export interface SeriesChild {
	asin: string;
	sequence: string | null;
	sort: string | null;
}

interface Relationship {
	asin?: string;
	relationship_to_product?: string;
	relationship_type?: string;
	sequence?: string;
	sort?: string;
}

// ============================================
// Client
// ============================================

export class AudibleCatalogClient {
	/** Attempts made, retries included */
	requests = 0;
	private consecutiveFailures = 0;
	private lastRequestAt = 0;

	constructor(readonly maxRequests: number = MAX_REQUESTS_PER_RUN) {}

	get remaining(): number {
		return Math.max(0, this.maxRequests - this.requests);
	}

	private baseUrl(): string {
		return (env.AUDIBLE_CATALOG_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
	}

	private async pace(): Promise<void> {
		const h = hooks();
		const wait = (h.delayMs ?? DELAY_MS) + Math.random() * (h.jitterMs ?? (h.delayMs === 0 ? 0 : JITTER_MS));
		const due = this.lastRequestAt + wait;
		await sleep(due - Date.now());
	}

	/**
	 * GET path?query and parse JSON. A 404 returns null when allowed (a delisted product), and
	 * counts as a success. Everything else that isn't 2xx is a failed request.
	 */
	private async get(pathAndQuery: string, allow404: boolean): Promise<unknown | null> {
		const transport = hooks().transport ?? fetch;
		const backoff = hooks().backoffMs ?? BACKOFF_MS;
		const url = `${this.baseUrl()}${pathAndQuery}`;
		let lastError = 'unknown error';
		let lastStatus: number | null = null;

		for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
			if (attempt > 0) await sleep(backoff[Math.min(attempt - 1, backoff.length - 1)] ?? 0);
			if (this.requests >= this.maxRequests) throw new CatalogBudgetExhausted();
			await this.pace();
			this.requests++;
			this.lastRequestAt = Date.now();

			let res: Response;
			try {
				res = await transport(url, {
					headers: { Accept: 'application/json', 'Accept-Language': 'en-US', 'User-Agent': USER_AGENT },
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
				});
			} catch (err) {
				lastError = err instanceof Error ? err.message : String(err);
				lastStatus = null;
				continue; // network error: retry
			}

			if (res.ok) {
				try {
					const body: unknown = await res.json();
					this.consecutiveFailures = 0;
					return body;
				} catch {
					lastError = 'invalid JSON from Audible';
					lastStatus = res.status;
					break;
				}
			}
			if (res.status === 404 && allow404) {
				this.consecutiveFailures = 0;
				return null;
			}
			lastError = `HTTP ${res.status}`;
			lastStatus = res.status;
			if (res.status === 429 || res.status >= 500) continue;
			break; // other 4xx: not retried
		}

		this.consecutiveFailures++;
		if (this.consecutiveFailures >= CIRCUIT_AFTER_FAILURES) throw new CatalogUnavailable(lastError);
		throw new CatalogRequestError(`Audible request failed: ${lastError}`, lastStatus);
	}

	/** Title + author search, up to 3 products */
	async searchTitleAuthor(title: string, author: string): Promise<AudibleProduct[]> {
		const q = new URLSearchParams({ title, num_results: '3', response_groups: PRODUCT_GROUPS });
		if (author.trim()) q.set('author', author.trim());
		const body = (await this.get(`?${q.toString()}`, false)) as { products?: AudibleProduct[] } | null;
		return Array.isArray(body?.products) ? body.products : [];
	}

	/**
	 * Every book of a series, from the series product's relationships. null when the series
	 * product itself is gone (404).
	 */
	async getSeriesChildren(seriesAsin: string): Promise<SeriesChild[] | null> {
		const q = new URLSearchParams({ response_groups: 'relationships' });
		const body = (await this.get(`/${encodeURIComponent(seriesAsin)}?${q.toString()}`, true)) as
			| { product?: { relationships?: Relationship[] } }
			| null;
		if (body === null) return null;
		const rels = Array.isArray(body.product?.relationships) ? body.product.relationships : [];
		const seen = new Set<string>();
		const children: SeriesChild[] = [];
		for (const r of rels) {
			if (r.relationship_to_product !== 'child' || r.relationship_type !== 'series' || !r.asin) continue;
			const asin = r.asin.trim().toUpperCase();
			if (!asin || seen.has(asin)) continue;
			seen.add(asin);
			children.push({ asin, sequence: r.sequence ?? null, sort: r.sort ?? null });
		}
		return children;
	}

	/**
	 * Full product data for up to BATCH_SIZE ASINs in one request. Products the response leaves
	 * out are reported as missing. If the batch request itself 404s, each ASIN is fetched alone
	 * and the ones that 404 are missing; a delisted product never fails the batch.
	 */
	async getProducts(asins: string[]): Promise<{ products: AudibleProduct[]; missing: string[] }> {
		const wanted = asins.map((a) => a.trim().toUpperCase());
		const q = new URLSearchParams({ asins: wanted.join(','), response_groups: PRODUCT_GROUPS, num_results: '50' });
		const body = (await this.get(`?${q.toString()}`, true)) as { products?: AudibleProduct[] } | null;

		let products: AudibleProduct[];
		if (body === null) {
			products = [];
			for (const asin of wanted) {
				const one = await this.getProduct(asin);
				if (one) products.push(one);
			}
		} else {
			products = Array.isArray(body.products) ? body.products : [];
		}

		const wantedSet = new Set(wanted);
		const kept = products.filter((p) => p?.asin && wantedSet.has(p.asin.trim().toUpperCase()));
		const got = new Set(kept.map((p) => p.asin.trim().toUpperCase()));
		return { products: kept, missing: wanted.filter((a) => !got.has(a)) };
	}

	/** One product; null when Audible no longer lists it (404) */
	async getProduct(asin: string): Promise<AudibleProduct | null> {
		const q = new URLSearchParams({ response_groups: PRODUCT_GROUPS });
		const body = (await this.get(`/${encodeURIComponent(asin)}?${q.toString()}`, true)) as { product?: AudibleProduct } | null;
		return body?.product ?? null;
	}
}
