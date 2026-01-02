<script lang="ts">
	import { goto } from '$app/navigation';
	import { Search, BookOpen, User, Library, Mic, X, Loader2 } from 'lucide-svelte';

	interface AutocompleteResult {
		books: { id: number; title: string; coverImageUrl: string | null; author: string | null; series: string | null; type: 'book'; url: string }[];
		authors: { id: number; name: string; type: 'author'; url: string }[];
		series: { id: number; title: string; type: 'series'; url: string }[];
		narrators: { id: number; name: string; type: 'narrator'; url: string }[];
	}

	let { onClose }: { onClose: () => void } = $props();

	let query = $state('');
	let results = $state<AutocompleteResult | null>(null);
	let loading = $state(false);
	let selectedIndex = $state(-1);
	let inputRef = $state<HTMLInputElement | null>(null);

	let debounceTimer: ReturnType<typeof setTimeout>;

	// Flatten results for keyboard navigation
	let flatResults = $derived(() => {
		if (!results) return [];
		const flat: { type: string; item: any; url: string }[] = [];

		for (const book of results.books) {
			flat.push({ type: 'book', item: book, url: book.url });
		}
		for (const author of results.authors) {
			flat.push({ type: 'author', item: author, url: author.url });
		}
		for (const s of results.series) {
			flat.push({ type: 'series', item: s, url: s.url });
		}
		for (const narrator of results.narrators) {
			flat.push({ type: 'narrator', item: narrator, url: narrator.url });
		}

		return flat;
	});

	let hasResults = $derived(
		results && (
			results.books.length > 0 ||
			results.authors.length > 0 ||
			results.series.length > 0 ||
			results.narrators.length > 0
		)
	);

	async function search() {
		if (query.length < 2) {
			results = null;
			return;
		}

		loading = true;
		try {
			const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(query)}`);
			if (res.ok) {
				results = await res.json();
				selectedIndex = -1;
			}
		} catch (error) {
			console.error('Search error:', error);
		} finally {
			loading = false;
		}
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(search, 200);
	}

	function handleKeydown(e: KeyboardEvent) {
		const flat = flatResults();

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, flat.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, -1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (selectedIndex >= 0 && flat[selectedIndex]) {
				navigateTo(flat[selectedIndex].url);
			} else if (query.length > 0) {
				// Go to advanced search with query
				navigateTo(`/search?title=${encodeURIComponent(query)}`);
			}
		} else if (e.key === 'Escape') {
			onClose();
		}
	}

	function navigateTo(url: string) {
		onClose();
		goto(url);
	}

	function clear() {
		query = '';
		results = null;
		selectedIndex = -1;
		inputRef?.focus();
	}

	$effect(() => {
		// Focus input on mount
		inputRef?.focus();
	});
</script>

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 bg-black/50 z-50"
	onclick={onClose}
	aria-label="Close search"
></button>

<!-- Search Panel -->
<div class="fixed top-0 left-0 right-0 z-50 p-4 sm:pt-[10vh]">
	<div class="max-w-2xl mx-auto rounded-xl shadow-2xl overflow-hidden" style="background-color: var(--bg-secondary);">
		<!-- Search Input -->
		<div class="flex items-center gap-3 p-4 border-b" style="border-color: var(--border-color);">
			<Search class="w-5 h-5 flex-shrink-0" style="color: var(--text-muted);" />
			<input
				bind:this={inputRef}
				type="text"
				placeholder="Search books, authors, series..."
				class="flex-1 text-lg outline-none"
				style="background: transparent; color: var(--text-primary);"
				bind:value={query}
				oninput={handleInput}
				onkeydown={handleKeydown}
			/>
			{#if loading}
				<Loader2 class="w-5 h-5 animate-spin" style="color: var(--text-muted);" />
			{:else if query}
				<button type="button" onclick={clear} class="p-1 rounded" style="color: var(--text-muted);">
					<X class="w-4 h-4" />
				</button>
			{/if}
		</div>

		<!-- Results -->
		{#if query.length >= 2}
			<div class="max-h-[60vh] overflow-y-auto">
				{#if hasResults}
					<!-- Books -->
					{#if results?.books && results.books.length > 0}
						<div class="p-2">
							<div class="px-3 py-1 text-xs font-medium uppercase tracking-wider" style="color: var(--text-muted);">Books</div>
							{#each results.books as book, i}
								{@const flatIndex = i}
								<button
									type="button"
									class="w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left"
									style="background-color: {selectedIndex === flatIndex ? 'var(--bg-hover)' : 'transparent'};"
									onclick={() => navigateTo(book.url)}
									onmouseenter={() => selectedIndex = flatIndex}
								>
									<div class="w-10 h-14 rounded overflow-hidden flex-shrink-0" style="background-color: var(--bg-tertiary);">
										<img
											src={book.coverImageUrl || '/placeholder.png'}
											alt=""
											class="w-full h-full object-cover"
											onerror={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
										/>
									</div>
									<div class="flex-1 min-w-0">
										<div class="font-medium truncate" style="color: var(--text-primary);">{book.title}</div>
										<div class="text-sm truncate" style="color: var(--text-muted);">
											{#if book.author}
												{book.author}
											{/if}
											{#if book.series}
												<span style="color: var(--text-muted);"> • {book.series}</span>
											{/if}
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Authors -->
					{#if results?.authors && results.authors.length > 0}
						<div class="p-2 border-t" style="border-color: var(--border-color);">
							<div class="px-3 py-1 text-xs font-medium uppercase tracking-wider" style="color: var(--text-muted);">Authors</div>
							{#each results.authors as author, i}
								{@const flatIndex = (results?.books?.length || 0) + i}
								<button
									type="button"
									class="w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left"
									style="background-color: {selectedIndex === flatIndex ? 'var(--bg-hover)' : 'transparent'};"
									onclick={() => navigateTo(author.url)}
									onmouseenter={() => selectedIndex = flatIndex}
								>
									<div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: var(--bg-tertiary);">
										<User class="w-5 h-5" style="color: var(--text-muted);" />
									</div>
									<div class="font-medium" style="color: var(--text-primary);">{author.name}</div>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Series -->
					{#if results?.series && results.series.length > 0}
						<div class="p-2 border-t" style="border-color: var(--border-color);">
							<div class="px-3 py-1 text-xs font-medium uppercase tracking-wider" style="color: var(--text-muted);">Series</div>
							{#each results.series as s, i}
								{@const flatIndex = (results?.books?.length || 0) + (results?.authors?.length || 0) + i}
								<button
									type="button"
									class="w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left"
									style="background-color: {selectedIndex === flatIndex ? 'var(--bg-hover)' : 'transparent'};"
									onclick={() => navigateTo(s.url)}
									onmouseenter={() => selectedIndex = flatIndex}
								>
									<div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background-color: var(--bg-tertiary);">
										<Library class="w-5 h-5" style="color: var(--text-muted);" />
									</div>
									<div class="font-medium" style="color: var(--text-primary);">{s.title}</div>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Narrators -->
					{#if results?.narrators && results.narrators.length > 0}
						<div class="p-2 border-t" style="border-color: var(--border-color);">
							<div class="px-3 py-1 text-xs font-medium uppercase tracking-wider" style="color: var(--text-muted);">Narrators</div>
							{#each results.narrators as narrator, i}
								{@const flatIndex = (results?.books?.length || 0) + (results?.authors?.length || 0) + (results?.series?.length || 0) + i}
								<button
									type="button"
									class="w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left"
									style="background-color: {selectedIndex === flatIndex ? 'var(--bg-hover)' : 'transparent'};"
									onclick={() => navigateTo(narrator.url)}
									onmouseenter={() => selectedIndex = flatIndex}
								>
									<div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: var(--bg-tertiary);">
										<Mic class="w-5 h-5" style="color: var(--text-muted);" />
									</div>
									<div class="font-medium" style="color: var(--text-primary);">{narrator.name}</div>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Advanced Search Link -->
					<div class="p-3 border-t" style="border-color: var(--border-color); background-color: var(--bg-tertiary);">
						<button
							type="button"
							class="w-full text-center text-sm font-medium"
							style="color: var(--accent);"
							onclick={() => navigateTo(`/search?title=${encodeURIComponent(query)}`)}
						>
							Advanced search for "{query}"
						</button>
					</div>
				{:else if !loading}
					<div class="p-8 text-center" style="color: var(--text-muted);">
						<Search class="w-12 h-12 mx-auto mb-3" style="color: var(--text-muted);" />
						<p>No results found for "{query}"</p>
						<button
							type="button"
							class="mt-4 text-sm"
							style="color: var(--accent);"
							onclick={() => navigateTo(`/search?title=${encodeURIComponent(query)}`)}
						>
							Try advanced search
						</button>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Quick Links -->
			<div class="p-4">
				<div class="text-xs font-medium uppercase tracking-wider mb-3" style="color: var(--text-muted);">Quick Access</div>
				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						class="flex items-center gap-2 p-3 rounded-lg transition-colors text-left hover:opacity-80"
						style="background-color: var(--bg-tertiary);"
						onclick={() => navigateTo('/books')}
					>
						<BookOpen class="w-5 h-5" style="color: var(--text-muted);" />
						<span class="text-sm font-medium" style="color: var(--text-primary);">All Books</span>
					</button>
					<button
						type="button"
						class="flex items-center gap-2 p-3 rounded-lg transition-colors text-left hover:opacity-80"
						style="background-color: var(--bg-tertiary);"
						onclick={() => navigateTo('/authors')}
					>
						<User class="w-5 h-5" style="color: var(--text-muted);" />
						<span class="text-sm font-medium" style="color: var(--text-primary);">Authors</span>
					</button>
					<button
						type="button"
						class="flex items-center gap-2 p-3 rounded-lg transition-colors text-left hover:opacity-80"
						style="background-color: var(--bg-tertiary);"
						onclick={() => navigateTo('/series')}
					>
						<Library class="w-5 h-5" style="color: var(--text-muted);" />
						<span class="text-sm font-medium" style="color: var(--text-primary);">Series</span>
					</button>
					<button
						type="button"
						class="flex items-center gap-2 p-3 rounded-lg transition-colors text-left hover:opacity-80"
						style="background-color: var(--bg-tertiary);"
						onclick={() => navigateTo('/search')}
					>
						<Search class="w-5 h-5" style="color: var(--text-muted);" />
						<span class="text-sm font-medium" style="color: var(--text-primary);">Advanced Search</span>
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Keyboard hints -->
	<div class="max-w-2xl mx-auto mt-3 flex items-center justify-center gap-4 text-xs" style="color: var(--text-muted);">
		<span><kbd class="px-1.5 py-0.5 rounded border shadow-sm" style="background-color: var(--bg-tertiary); border-color: var(--border-color);">↑</kbd> <kbd class="px-1.5 py-0.5 rounded border shadow-sm" style="background-color: var(--bg-tertiary); border-color: var(--border-color);">↓</kbd> to navigate</span>
		<span><kbd class="px-1.5 py-0.5 rounded border shadow-sm" style="background-color: var(--bg-tertiary); border-color: var(--border-color);">Enter</kbd> to select</span>
		<span><kbd class="px-1.5 py-0.5 rounded border shadow-sm" style="background-color: var(--bg-tertiary); border-color: var(--border-color);">Esc</kbd> to close</span>
	</div>
</div>
