<script lang="ts">
	import { X, Search, Loader2, Check, ExternalLink, Star, Book, Database } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';

	interface MetadataResult {
		provider: string;
		providerId?: string;
		title?: string;
		subtitle?: string;
		authors?: string[];
		description?: string;
		publisher?: string;
		publishedDate?: string;
		publishYear?: number;
		pageCount?: number;
		language?: string;
		isbn10?: string;
		isbn13?: string;
		coverUrl?: string;
		thumbnailUrl?: string;
		genres?: string[];
		seriesName?: string;
		seriesNumber?: number;
		rating?: number;
		ratingCount?: number;
	}

	interface Props {
		open: boolean;
		initialTitle?: string;
		initialAuthor?: string;
		initialIsbn?: string;
		onClose: () => void;
		onApply: (data: MetadataResult, selectedFields: string[]) => void;
	}

	let { open, initialTitle = '', initialAuthor = '', initialIsbn = '', onClose, onApply }: Props = $props();

	// Search state
	let searchTitle = $state(initialTitle);
	let searchAuthor = $state(initialAuthor);
	let searchIsbn = $state(initialIsbn);
	let isSearching = $state(false);
	let searchError = $state('');

	// Results state
	let results = $state<Record<string, MetadataResult[]>>({});
	let selectedProvider = $state<string>('');
	let selectedResult = $state<MetadataResult | null>(null);
	let loadingDetails = $state(false);

	// Field selection for applying
	let selectedFields = $state<Set<string>>(new Set([
		'title', 'summary', 'coverUrl', 'isbn13', 'isbn10', 'publisher', 'publishYear', 'pageCount', 'language'
	]));

	const providerNames: Record<string, string> = {
		googlebooks: 'Google Books',
		openlibrary: 'Open Library',
		goodreads: 'Goodreads',
		hardcover: 'Hardcover'
	};

	const providerColors: Record<string, string> = {
		googlebooks: '#4285F4',
		openlibrary: '#e08741',
		goodreads: '#553B08',
		hardcover: '#8B5CF6'
	};

	const fieldLabels: Record<string, string> = {
		title: 'Title',
		subtitle: 'Subtitle',
		summary: 'Summary/Description',
		coverUrl: 'Cover Image',
		isbn13: 'ISBN-13',
		isbn10: 'ISBN-10',
		publisher: 'Publisher',
		publishYear: 'Publish Year',
		pageCount: 'Page Count',
		language: 'Language',
		genres: 'Genres',
		seriesName: 'Series',
		seriesNumber: 'Series Number',
		rating: 'Rating'
	};

	// Reset when modal opens
	$effect(() => {
		if (open) {
			searchTitle = initialTitle;
			searchAuthor = initialAuthor;
			searchIsbn = initialIsbn;
			results = {};
			selectedResult = null;
			selectedProvider = '';
			searchError = '';
		}
	});

	async function handleSearch() {
		if (!searchTitle.trim() && !searchAuthor.trim() && !searchIsbn.trim()) {
			searchError = 'Enter a title, author, or ISBN to search';
			return;
		}

		isSearching = true;
		searchError = '';
		results = {};
		selectedResult = null;

		try {
			const params = new URLSearchParams();
			if (searchTitle.trim()) params.set('q', searchTitle.trim());
			if (searchIsbn.trim()) params.set('isbn', searchIsbn.trim());

			// Build search query combining title and author
			let query = searchTitle.trim();
			if (searchAuthor.trim()) {
				query += ' ' + searchAuthor.trim();
			}
			if (query) params.set('q', query);

			const res = await fetch(`/api/metadata/search?${params}`);
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || 'Search failed');
			}

			const data = await res.json();
			results = data.results || {};

			// Auto-select first provider with results
			const providersWithResults = Object.keys(results).filter(p => results[p]?.length > 0);
			if (providersWithResults.length > 0) {
				selectedProvider = providersWithResults[0];
			}
		} catch (err) {
			searchError = err instanceof Error ? err.message : 'Search failed';
		} finally {
			isSearching = false;
		}
	}

	async function selectResult(result: MetadataResult) {
		selectedResult = result;

		// If this is just a preview (no description), fetch full details
		if (!result.description && result.providerId) {
			loadingDetails = true;
			try {
				const res = await fetch(`/api/metadata/${result.provider}/${encodeURIComponent(result.providerId)}`);
				if (res.ok) {
					const data = await res.json();
					if (data.result) {
						selectedResult = data.result;
					}
				}
			} catch {
				// Keep the preview data if details fail
			} finally {
				loadingDetails = false;
			}
		}
	}

	function toggleField(field: string) {
		const newSet = new Set(selectedFields);
		if (newSet.has(field)) {
			newSet.delete(field);
		} else {
			newSet.add(field);
		}
		selectedFields = newSet;
	}

	function handleApply() {
		if (selectedResult) {
			onApply(selectedResult, Array.from(selectedFields));
			onClose();
		}
	}

	function getResultValue(result: MetadataResult, field: string): string | undefined {
		const value = result[field as keyof MetadataResult];
		if (value === undefined || value === null) return undefined;
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
		onclick={onClose}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
			style="background-color: var(--bg-secondary);"
			transition:scale={{ duration: 150, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--border-color);">
				<div class="flex items-center gap-3">
					<Database class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="text-xl font-semibold" style="color: var(--text-primary);">Search Book Metadata</h2>
				</div>
				<button
					type="button"
					class="p-2 rounded-lg transition-colors hover:bg-black/10"
					style="color: var(--text-muted);"
					onclick={onClose}
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-hidden flex">
				<!-- Left: Search & Results -->
				<div class="w-1/2 border-r flex flex-col" style="border-color: var(--border-color);">
					<!-- Search Form -->
					<div class="p-4 border-b" style="border-color: var(--border-color);">
						<div class="space-y-3">
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label class="block text-xs font-medium mb-1" style="color: var(--text-muted);">Title</label>
									<input
										type="text"
										bind:value={searchTitle}
										placeholder="Book title..."
										class="w-full px-3 py-2 rounded-lg text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										onkeydown={(e) => e.key === 'Enter' && handleSearch()}
									/>
								</div>
								<div>
									<label class="block text-xs font-medium mb-1" style="color: var(--text-muted);">Author</label>
									<input
										type="text"
										bind:value={searchAuthor}
										placeholder="Author name..."
										class="w-full px-3 py-2 rounded-lg text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										onkeydown={(e) => e.key === 'Enter' && handleSearch()}
									/>
								</div>
							</div>
							<div class="flex gap-3">
								<div class="flex-1">
									<label class="block text-xs font-medium mb-1" style="color: var(--text-muted);">ISBN</label>
									<input
										type="text"
										bind:value={searchIsbn}
										placeholder="ISBN-10 or ISBN-13..."
										class="w-full px-3 py-2 rounded-lg text-sm font-mono"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										onkeydown={(e) => e.key === 'Enter' && handleSearch()}
									/>
								</div>
								<div class="flex items-end">
									<button
										type="button"
										class="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
										style="background-color: var(--accent); color: white;"
										onclick={handleSearch}
										disabled={isSearching}
									>
										{#if isSearching}
											<Loader2 class="w-4 h-4 animate-spin" />
										{:else}
											<Search class="w-4 h-4" />
										{/if}
										Search
									</button>
								</div>
							</div>
						</div>

						{#if searchError}
							<p class="mt-2 text-sm" style="color: #ef4444;">{searchError}</p>
						{/if}
					</div>

					<!-- Provider Tabs -->
					{#if Object.keys(results).length > 0}
						<div class="flex border-b overflow-x-auto" style="border-color: var(--border-color);">
							{#each Object.entries(results) as [provider, providerResults]}
								<button
									type="button"
									class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
									style="
										border-bottom: 2px solid {selectedProvider === provider ? providerColors[provider] || 'var(--accent)' : 'transparent'};
										color: {selectedProvider === provider ? 'var(--text-primary)' : 'var(--text-muted)'};
									"
									onclick={() => { selectedProvider = provider; selectedResult = null; }}
								>
									{providerNames[provider] || provider}
									<span class="ml-1 px-1.5 py-0.5 rounded text-xs" style="background-color: var(--bg-tertiary);">
										{providerResults.length}
									</span>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Results List -->
					<div class="flex-1 overflow-y-auto p-2">
						{#if isSearching}
							<div class="flex items-center justify-center h-full">
								<div class="text-center">
									<Loader2 class="w-8 h-8 animate-spin mx-auto mb-2" style="color: var(--accent);" />
									<p class="text-sm" style="color: var(--text-muted);">Searching providers...</p>
								</div>
							</div>
						{:else if Object.keys(results).length === 0}
							<div class="flex items-center justify-center h-full">
								<div class="text-center">
									<Search class="w-8 h-8 mx-auto mb-2" style="color: var(--text-muted);" />
									<p class="text-sm" style="color: var(--text-muted);">Enter search criteria above</p>
								</div>
							</div>
						{:else if selectedProvider && results[selectedProvider]}
							<div class="space-y-2">
								{#each results[selectedProvider] as result}
									<button
										type="button"
										class="w-full p-3 rounded-lg text-left transition-all flex gap-3"
										style="
											background-color: {selectedResult?.providerId === result.providerId ? 'var(--bg-hover)' : 'var(--bg-tertiary)'};
											border: 1px solid {selectedResult?.providerId === result.providerId ? 'var(--accent)' : 'var(--border-color)'};
										"
										onclick={() => selectResult(result)}
									>
										<!-- Thumbnail -->
										<div class="w-12 h-16 rounded overflow-hidden flex-shrink-0" style="background-color: var(--bg-secondary);">
											{#if result.thumbnailUrl || result.coverUrl}
												<img
													src={result.thumbnailUrl || result.coverUrl}
													alt=""
													class="w-full h-full object-cover"
													onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
												/>
											{:else}
												<div class="w-full h-full flex items-center justify-center">
													<Book class="w-5 h-5" style="color: var(--text-muted);" />
												</div>
											{/if}
										</div>

										<!-- Info -->
										<div class="flex-1 min-w-0">
											<p class="font-medium text-sm truncate" style="color: var(--text-primary);">
												{result.title || 'Untitled'}
											</p>
											{#if result.authors?.length}
												<p class="text-xs truncate" style="color: var(--text-muted);">
													{result.authors.join(', ')}
												</p>
											{/if}
											<div class="flex items-center gap-2 mt-1">
												{#if result.publishYear}
													<span class="text-xs" style="color: var(--text-muted);">{result.publishYear}</span>
												{/if}
												{#if result.rating}
													<span class="text-xs flex items-center gap-0.5" style="color: #fbbf24;">
														<Star class="w-3 h-3" style="fill: currentColor;" />
														{result.rating.toFixed(1)}
													</span>
												{/if}
											</div>
										</div>

										{#if selectedResult?.providerId === result.providerId}
											<Check class="w-5 h-5 flex-shrink-0" style="color: var(--accent);" />
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Right: Preview & Field Selection -->
				<div class="w-1/2 flex flex-col">
					{#if selectedResult}
						{#if loadingDetails}
							<div class="flex-1 flex items-center justify-center">
								<div class="text-center">
									<Loader2 class="w-8 h-8 animate-spin mx-auto mb-2" style="color: var(--accent);" />
									<p class="text-sm" style="color: var(--text-muted);">Loading details...</p>
								</div>
							</div>
						{:else}
							<!-- Preview -->
							<div class="p-4 border-b overflow-y-auto" style="border-color: var(--border-color); max-height: 50%;">
								<div class="flex gap-4">
									<!-- Cover -->
									<div class="w-24 h-36 rounded-lg overflow-hidden flex-shrink-0" style="background-color: var(--bg-tertiary);">
										{#if selectedResult.coverUrl}
											<img
												src={selectedResult.coverUrl}
												alt=""
												class="w-full h-full object-cover"
											/>
										{:else}
											<div class="w-full h-full flex items-center justify-center">
												<Book class="w-8 h-8" style="color: var(--text-muted);" />
											</div>
										{/if}
									</div>

									<!-- Details -->
									<div class="flex-1 min-w-0">
										<h3 class="font-semibold" style="color: var(--text-primary);">
											{selectedResult.title}
										</h3>
										{#if selectedResult.subtitle}
											<p class="text-sm" style="color: var(--text-secondary);">{selectedResult.subtitle}</p>
										{/if}
										{#if selectedResult.authors?.length}
											<p class="text-sm mt-1" style="color: var(--text-muted);">
												by {selectedResult.authors.join(', ')}
											</p>
										{/if}

										<div class="flex flex-wrap gap-2 mt-2">
											{#if selectedResult.publishYear}
												<span class="px-2 py-0.5 rounded text-xs" style="background-color: var(--bg-tertiary); color: var(--text-secondary);">
													{selectedResult.publishYear}
												</span>
											{/if}
											{#if selectedResult.pageCount}
												<span class="px-2 py-0.5 rounded text-xs" style="background-color: var(--bg-tertiary); color: var(--text-secondary);">
													{selectedResult.pageCount} pages
												</span>
											{/if}
											{#if selectedResult.rating}
												<span class="px-2 py-0.5 rounded text-xs flex items-center gap-1" style="background-color: rgba(251, 191, 36, 0.1); color: #fbbf24;">
													<Star class="w-3 h-3" style="fill: currentColor;" />
													{selectedResult.rating.toFixed(1)}
													{#if selectedResult.ratingCount}
														<span style="color: var(--text-muted);">({selectedResult.ratingCount.toLocaleString()})</span>
													{/if}
												</span>
											{/if}
										</div>

										{#if selectedResult.seriesName}
											<p class="text-sm mt-2" style="color: var(--accent);">
												{selectedResult.seriesName}
												{#if selectedResult.seriesNumber}
													#{selectedResult.seriesNumber}
												{/if}
											</p>
										{/if}

										{#if selectedResult.description}
											<p class="text-xs mt-2 line-clamp-4" style="color: var(--text-muted);">
												{selectedResult.description}
											</p>
										{/if}
									</div>
								</div>
							</div>

							<!-- Field Selection -->
							<div class="flex-1 p-4 overflow-y-auto">
								<h4 class="text-sm font-medium mb-3" style="color: var(--text-primary);">Select fields to apply:</h4>
								<div class="space-y-2">
									{#each Object.entries(fieldLabels) as [field, label]}
										{@const value = getResultValue(selectedResult, field === 'summary' ? 'description' : field)}
										{#if value}
											<label
												class="flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors"
												style="background-color: {selectedFields.has(field) ? 'var(--bg-hover)' : 'transparent'};"
											>
												<input
													type="checkbox"
													checked={selectedFields.has(field)}
													onchange={() => toggleField(field)}
													class="mt-1"
												/>
												<div class="flex-1 min-w-0">
													<p class="text-sm font-medium" style="color: var(--text-primary);">{label}</p>
													<p class="text-xs truncate" style="color: var(--text-muted);">
														{field === 'coverUrl' ? '(image URL)' : value}
													</p>
												</div>
											</label>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					{:else}
						<div class="flex-1 flex items-center justify-center">
							<div class="text-center p-8">
								<Book class="w-12 h-12 mx-auto mb-3" style="color: var(--text-muted);" />
								<p class="text-sm" style="color: var(--text-muted);">
									Select a result to preview and apply
								</p>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between px-6 py-4 border-t" style="border-color: var(--border-color);">
				<p class="text-xs" style="color: var(--text-muted);">
					{#if selectedResult}
						Source: {providerNames[selectedResult.provider] || selectedResult.provider}
					{:else}
						Search across Google Books, Open Library, Goodreads, and Hardcover
					{/if}
				</p>
				<div class="flex gap-3">
					<button
						type="button"
						class="px-4 py-2 rounded-lg text-sm font-medium"
						style="color: var(--text-muted);"
						onclick={onClose}
					>
						Cancel
					</button>
					<button
						type="button"
						class="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
						style="background-color: var(--accent); color: white;"
						onclick={handleApply}
						disabled={!selectedResult || selectedFields.size === 0}
					>
						<Check class="w-4 h-4" />
						Apply Selected Fields
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
