/**
 * Metadata Providers Registry
 *
 * Unified interface for searching and fetching book metadata from multiple sources
 */

import type {
	MetadataProvider,
	MetadataProviderInterface,
	MetadataSearchRequest,
	BookMetadataResult
} from './types';
import { GoogleBooksProvider } from './googleBooksProvider';
import { OpenLibraryProvider } from './openLibraryProvider';
import { GoodreadsProvider } from './goodreadsProvider';
import { HardcoverProvider } from './hardcoverProvider';
import { AmazonProvider } from './amazonProvider';
import { ComicVineProvider } from './comicVineProvider';

// Re-export types
export * from './types';

export interface MetadataProviderConfig {
	enabled: boolean;
	priority: number;
	apiKey?: string;
}

export interface AmazonProviderConfig extends MetadataProviderConfig {
	domain?: 'com' | 'co.uk' | 'de' | 'fr' | 'it' | 'es' | 'ca' | 'com.au' | 'co.jp' | 'in';
}

export interface MetadataProvidersSettings {
	googlebooks: MetadataProviderConfig;
	openlibrary: MetadataProviderConfig;
	goodreads: MetadataProviderConfig;
	hardcover: MetadataProviderConfig;
	amazon: AmazonProviderConfig;
	comicvine: MetadataProviderConfig;
}

const DEFAULT_SETTINGS: MetadataProvidersSettings = {
	googlebooks: { enabled: true, priority: 1 },
	openlibrary: { enabled: true, priority: 2 },
	goodreads: { enabled: true, priority: 3 },
	hardcover: { enabled: false, priority: 4 }, // Disabled by default (requires API key)
	amazon: { enabled: false, priority: 5, domain: 'com' }, // Disabled by default (web scraping, may be unreliable)
	comicvine: { enabled: false, priority: 6 } // Disabled by default (requires API key)
};

class MetadataProviderRegistry {
	private providers: Map<MetadataProvider, MetadataProviderInterface> = new Map();
	private settings: MetadataProvidersSettings = DEFAULT_SETTINGS;

	constructor() {
		// Initialize all providers
		this.providers.set('googlebooks', new GoogleBooksProvider());
		this.providers.set('openlibrary', new OpenLibraryProvider());
		this.providers.set('goodreads', new GoodreadsProvider());
		this.providers.set('hardcover', new HardcoverProvider());
		this.providers.set('amazon', new AmazonProvider());
		this.providers.set('comicvine', new ComicVineProvider());
	}

	/**
	 * Update provider settings
	 */
	configure(settings: Partial<MetadataProvidersSettings>): void {
		this.settings = { ...this.settings, ...settings };

		// Update Hardcover API key if provided
		if (settings.hardcover?.apiKey) {
			const hardcoverProvider = this.providers.get('hardcover') as HardcoverProvider;
			hardcoverProvider.setApiKey(settings.hardcover.apiKey);
		}

		// Update Amazon domain if provided
		if (settings.amazon?.domain) {
			const amazonProvider = this.providers.get('amazon') as AmazonProvider;
			amazonProvider.setDomain(settings.amazon.domain);
		}

		// Update ComicVine API key if provided
		if (settings.comicvine?.apiKey) {
			const comicvineProvider = this.providers.get('comicvine') as ComicVineProvider;
			comicvineProvider.setApiKey(settings.comicvine.apiKey);
		}
	}

	/**
	 * Get a specific provider
	 */
	getProvider(name: MetadataProvider): MetadataProviderInterface | undefined {
		return this.providers.get(name);
	}

	/**
	 * Get all enabled providers sorted by priority
	 */
	getEnabledProviders(): MetadataProviderInterface[] {
		return Object.entries(this.settings)
			.filter(([_, config]) => config.enabled)
			.sort((a, b) => a[1].priority - b[1].priority)
			.map(([name]) => this.providers.get(name as MetadataProvider))
			.filter((p): p is MetadataProviderInterface => p !== undefined);
	}

	/**
	 * Get provider info for UI
	 */
	getProviderInfo(): Array<{
		name: MetadataProvider;
		displayName: string;
		enabled: boolean;
		priority: number;
		requiresAuth: boolean;
		hasApiKey: boolean;
	}> {
		return Array.from(this.providers.entries()).map(([name, provider]) => {
			const config = this.settings[name];
			return {
				name,
				displayName: provider.displayName,
				enabled: config.enabled,
				priority: config.priority,
				requiresAuth: provider.requiresAuth,
				hasApiKey: !!config.apiKey
			};
		});
	}

	/**
	 * Search all enabled providers and return combined results
	 */
	async searchAll(
		request: MetadataSearchRequest,
		options?: {
			limit?: number;
			providers?: MetadataProvider[];
		}
	): Promise<Map<MetadataProvider, BookMetadataResult[]>> {
		const limit = options?.limit || 10;
		const results = new Map<MetadataProvider, BookMetadataResult[]>();

		// Determine which providers to use
		let providers = this.getEnabledProviders();
		if (options?.providers) {
			providers = providers.filter((p) => options.providers!.includes(p.name));
		}

		// Search all providers in parallel
		const searchPromises = providers.map(async (provider) => {
			try {
				const providerResults = await provider.search(request, limit);
				return { provider: provider.name, results: providerResults };
			} catch (error) {
				console.error(`Error searching ${provider.name}:`, error);
				return { provider: provider.name, results: [] };
			}
		});

		const allResults = await Promise.all(searchPromises);

		for (const { provider, results: providerResults } of allResults) {
			results.set(provider, providerResults);
		}

		return results;
	}

	/**
	 * Search a single provider
	 */
	async search(
		provider: MetadataProvider,
		request: MetadataSearchRequest,
		limit = 10
	): Promise<BookMetadataResult[]> {
		const providerInstance = this.providers.get(provider);
		if (!providerInstance) {
			console.error(`Unknown provider: ${provider}`);
			return [];
		}

		try {
			return await providerInstance.search(request, limit);
		} catch (error) {
			console.error(`Error searching ${provider}:`, error);
			return [];
		}
	}

	/**
	 * Fetch detailed metadata from a specific provider
	 */
	async fetchDetails(
		provider: MetadataProvider,
		providerId: string
	): Promise<BookMetadataResult | null> {
		const providerInstance = this.providers.get(provider);
		if (!providerInstance) {
			console.error(`Unknown provider: ${provider}`);
			return null;
		}

		try {
			return await providerInstance.fetchDetails(providerId);
		} catch (error) {
			console.error(`Error fetching details from ${provider}:`, error);
			return null;
		}
	}

	/**
	 * Find best metadata across all providers
	 * Searches all enabled providers and returns the best result
	 */
	async findBest(request: MetadataSearchRequest): Promise<BookMetadataResult | null> {
		const allResults = await this.searchAll(request, { limit: 5 });

		// Flatten and score results
		const scoredResults: Array<{ result: BookMetadataResult; score: number }> = [];

		for (const [_, providerResults] of allResults) {
			for (const result of providerResults) {
				const score = this.scoreResult(result, request);
				scoredResults.push({ result, score });
			}
		}

		// Sort by score (highest first)
		scoredResults.sort((a, b) => b.score - a.score);

		return scoredResults.length > 0 ? scoredResults[0].result : null;
	}

	/**
	 * Score a result based on how well it matches the request
	 */
	private scoreResult(result: BookMetadataResult, request: MetadataSearchRequest): number {
		let score = 0;

		// Title match
		if (result.title && request.title) {
			const titleLower = result.title.toLowerCase();
			const queryLower = request.title.toLowerCase();
			if (titleLower === queryLower) {
				score += 100;
			} else if (titleLower.includes(queryLower)) {
				score += 50;
			}
		}

		// Author match
		if (result.authors && request.author) {
			const queryLower = request.author.toLowerCase();
			for (const author of result.authors) {
				if (author.toLowerCase().includes(queryLower)) {
					score += 30;
					break;
				}
			}
		}

		// ISBN match (exact)
		if (request.isbn) {
			const cleanIsbn = request.isbn.replace(/[-\s]/g, '');
			if (result.isbn13 === cleanIsbn || result.isbn10 === cleanIsbn) {
				score += 200; // ISBN match is very strong
			}
		}

		// Bonus for complete data
		if (result.description) score += 10;
		if (result.coverUrl) score += 15;
		if (result.pageCount) score += 5;
		if (result.publishYear) score += 5;
		if (result.genres && result.genres.length > 0) score += 5;
		if (result.rating) score += 5;
		if (result.seriesName) score += 5;

		return score;
	}
}

// Export singleton instance
export const metadataProviders = new MetadataProviderRegistry();
