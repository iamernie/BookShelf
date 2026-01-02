<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ChevronDown, ChevronRight, X, Filter } from 'lucide-svelte';

	interface FilterOption {
		id: number;
		name: string;
		color?: string | null;
		bookCount?: number;
	}

	let {
		statuses = [],
		genres = [],
		formats = [],
		tags = [],
		authors = [],
		series = [],
		selectedStatus,
		selectedGenre,
		selectedFormat,
		selectedTag,
		selectedAuthor,
		selectedSeries,
		filterMode = 'and'
	}: {
		statuses?: FilterOption[];
		genres?: FilterOption[];
		formats?: FilterOption[];
		tags?: FilterOption[];
		authors?: FilterOption[];
		series?: FilterOption[];
		selectedStatus?: number;
		selectedGenre?: number;
		selectedFormat?: number;
		selectedTag?: number;
		selectedAuthor?: number;
		selectedSeries?: number;
		filterMode?: 'and' | 'or';
	} = $props();

	// Track which sections are expanded
	let expandedSections = $state<Record<string, boolean>>({
		status: true,
		genre: true,
		format: false,
		tags: false,
		authors: false,
		series: false
	});

	function toggleSection(section: string) {
		expandedSections[section] = !expandedSections[section];
	}

	function applyFilter(key: string, value: number | undefined) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value !== undefined) {
			params.set(key, value.toString());
		} else {
			params.delete(key);
		}
		params.delete('page'); // Reset to page 1
		goto(`/books?${params.toString()}`);
	}

	function clearFilters() {
		const params = new URLSearchParams();
		const search = $page.url.searchParams.get('search');
		if (search) params.set('search', search);
		// Preserve filter mode when clearing
		const mode = $page.url.searchParams.get('filterMode');
		if (mode) params.set('filterMode', mode);
		goto(`/books?${params.toString()}`);
	}

	function toggleFilterMode() {
		const params = new URLSearchParams($page.url.searchParams);
		const currentMode = params.get('filterMode') || 'and';
		params.set('filterMode', currentMode === 'and' ? 'or' : 'and');
		params.delete('page'); // Reset to page 1
		goto(`/books?${params.toString()}`);
	}

	let hasActiveFilters = $derived(
		selectedStatus !== undefined ||
		selectedGenre !== undefined ||
		selectedFormat !== undefined ||
		selectedTag !== undefined ||
		selectedAuthor !== undefined ||
		selectedSeries !== undefined
	);

	function FilterSection({
		title,
		section,
		items,
		selectedId,
		filterKey
	}: {
		title: string;
		section: string;
		items: FilterOption[];
		selectedId: number | undefined;
		filterKey: string;
	}) {
		return { title, section, items, selectedId, filterKey };
	}
</script>

<aside class="w-64 flex-shrink-0 overflow-y-auto" style="background-color: var(--bg-secondary); border-right: 1px solid var(--border-color);">
	<div class="p-4">
		<!-- Header -->
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-2">
				<Filter class="w-4 h-4" style="color: var(--text-muted);" />
				<h2 class="font-semibold" style="color: var(--text-primary);">Filters</h2>
			</div>
			{#if hasActiveFilters}
				<button
					type="button"
					class="text-xs px-2 py-1 rounded transition-colors"
					style="color: var(--accent); background-color: transparent;"
					onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
					onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
					onclick={clearFilters}
				>
					Clear all
				</button>
			{/if}
		</div>

		<!-- Filter Mode Toggle -->
		{#if hasActiveFilters}
			<div class="mb-4 p-2 rounded-lg" style="background-color: var(--bg-tertiary);">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium" style="color: var(--text-muted);">Match</span>
					<button
						type="button"
						class="flex items-center rounded-full text-xs font-medium overflow-hidden"
						style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						onclick={toggleFilterMode}
					>
						<span
							class="px-2 py-1 transition-colors"
							style="background-color: {filterMode === 'and' ? 'var(--accent)' : 'transparent'}; color: {filterMode === 'and' ? 'white' : 'var(--text-muted)'};"
						>
							ALL
						</span>
						<span
							class="px-2 py-1 transition-colors"
							style="background-color: {filterMode === 'or' ? 'var(--accent)' : 'transparent'}; color: {filterMode === 'or' ? 'white' : 'var(--text-muted)'};"
						>
							ANY
						</span>
					</button>
				</div>
				<p class="text-[10px] mt-1" style="color: var(--text-muted);">
					{filterMode === 'and' ? 'Books must match all selected filters' : 'Books can match any selected filter'}
				</p>
			</div>
		{/if}

		<!-- Status Section -->
		<div class="mb-3">
			<button
				type="button"
				class="w-full flex items-center justify-between py-2 text-sm font-medium"
				style="color: var(--text-primary);"
				onclick={() => toggleSection('status')}
			>
				<span>Status</span>
				{#if expandedSections.status}
					<ChevronDown class="w-4 h-4" style="color: var(--text-muted);" />
				{:else}
					<ChevronRight class="w-4 h-4" style="color: var(--text-muted);" />
				{/if}
			</button>
			{#if expandedSections.status}
				<div class="space-y-1 mt-1">
					<button
						type="button"
						class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
						style="color: {selectedStatus === undefined ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedStatus === undefined ? 'var(--bg-hover)' : 'transparent'};"
						onclick={() => applyFilter('status', undefined)}
					>
						All
					</button>
					{#each statuses as status}
						<button
							type="button"
							class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-2"
							style="color: {selectedStatus === status.id ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedStatus === status.id ? 'var(--bg-hover)' : 'transparent'};"
							onclick={() => applyFilter('status', status.id)}
						>
							{#if status.color}
								<span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: {status.color};"></span>
							{/if}
							<span class="truncate">{status.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Genre Section -->
		<div class="mb-3">
			<button
				type="button"
				class="w-full flex items-center justify-between py-2 text-sm font-medium"
				style="color: var(--text-primary);"
				onclick={() => toggleSection('genre')}
			>
				<span>Genre</span>
				{#if expandedSections.genre}
					<ChevronDown class="w-4 h-4" style="color: var(--text-muted);" />
				{:else}
					<ChevronRight class="w-4 h-4" style="color: var(--text-muted);" />
				{/if}
			</button>
			{#if expandedSections.genre}
				<div class="space-y-1 mt-1">
					<button
						type="button"
						class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
						style="color: {selectedGenre === undefined ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedGenre === undefined ? 'var(--bg-hover)' : 'transparent'};"
						onclick={() => applyFilter('genre', undefined)}
					>
						All
					</button>
					{#each genres as genre}
						<button
							type="button"
							class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-2"
							style="color: {selectedGenre === genre.id ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedGenre === genre.id ? 'var(--bg-hover)' : 'transparent'};"
							onclick={() => applyFilter('genre', genre.id)}
						>
							{#if genre.color}
								<span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: {genre.color};"></span>
							{/if}
							<span class="truncate">{genre.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Format Section -->
		<div class="mb-3">
			<button
				type="button"
				class="w-full flex items-center justify-between py-2 text-sm font-medium"
				style="color: var(--text-primary);"
				onclick={() => toggleSection('format')}
			>
				<span>Format</span>
				{#if expandedSections.format}
					<ChevronDown class="w-4 h-4" style="color: var(--text-muted);" />
				{:else}
					<ChevronRight class="w-4 h-4" style="color: var(--text-muted);" />
				{/if}
			</button>
			{#if expandedSections.format}
				<div class="space-y-1 mt-1">
					<button
						type="button"
						class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
						style="color: {selectedFormat === undefined ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedFormat === undefined ? 'var(--bg-hover)' : 'transparent'};"
						onclick={() => applyFilter('format', undefined)}
					>
						All
					</button>
					{#each formats as format}
						<button
							type="button"
							class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
							style="color: {selectedFormat === format.id ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedFormat === format.id ? 'var(--bg-hover)' : 'transparent'};"
							onclick={() => applyFilter('format', format.id)}
						>
							{format.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Tags Section -->
		<div class="mb-3">
			<button
				type="button"
				class="w-full flex items-center justify-between py-2 text-sm font-medium"
				style="color: var(--text-primary);"
				onclick={() => toggleSection('tags')}
			>
				<span>Tags</span>
				{#if expandedSections.tags}
					<ChevronDown class="w-4 h-4" style="color: var(--text-muted);" />
				{:else}
					<ChevronRight class="w-4 h-4" style="color: var(--text-muted);" />
				{/if}
			</button>
			{#if expandedSections.tags}
				<div class="space-y-1 mt-1">
					<button
						type="button"
						class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
						style="color: {selectedTag === undefined ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedTag === undefined ? 'var(--bg-hover)' : 'transparent'};"
						onclick={() => applyFilter('tag', undefined)}
					>
						All
					</button>
					{#each tags as tag}
						<button
							type="button"
							class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
							style="color: {selectedTag === tag.id ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedTag === tag.id ? 'var(--bg-hover)' : 'transparent'};"
							onclick={() => applyFilter('tag', tag.id)}
						>
							{tag.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Authors Section -->
		<div class="mb-3">
			<button
				type="button"
				class="w-full flex items-center justify-between py-2 text-sm font-medium"
				style="color: var(--text-primary);"
				onclick={() => toggleSection('authors')}
			>
				<span>Authors</span>
				{#if expandedSections.authors}
					<ChevronDown class="w-4 h-4" style="color: var(--text-muted);" />
				{:else}
					<ChevronRight class="w-4 h-4" style="color: var(--text-muted);" />
				{/if}
			</button>
			{#if expandedSections.authors}
				<div class="space-y-1 mt-1 max-h-48 overflow-y-auto">
					<button
						type="button"
						class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
						style="color: {selectedAuthor === undefined ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedAuthor === undefined ? 'var(--bg-hover)' : 'transparent'};"
						onclick={() => applyFilter('author', undefined)}
					>
						All
					</button>
					{#each authors as author}
						<button
							type="button"
							class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors truncate"
							style="color: {selectedAuthor === author.id ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedAuthor === author.id ? 'var(--bg-hover)' : 'transparent'};"
							onclick={() => applyFilter('author', author.id)}
						>
							{author.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Series Section -->
		<div class="mb-3">
			<button
				type="button"
				class="w-full flex items-center justify-between py-2 text-sm font-medium"
				style="color: var(--text-primary);"
				onclick={() => toggleSection('series')}
			>
				<span>Series</span>
				{#if expandedSections.series}
					<ChevronDown class="w-4 h-4" style="color: var(--text-muted);" />
				{:else}
					<ChevronRight class="w-4 h-4" style="color: var(--text-muted);" />
				{/if}
			</button>
			{#if expandedSections.series}
				<div class="space-y-1 mt-1 max-h-48 overflow-y-auto">
					<button
						type="button"
						class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
						style="color: {selectedSeries === undefined ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedSeries === undefined ? 'var(--bg-hover)' : 'transparent'};"
						onclick={() => applyFilter('series', undefined)}
					>
						All
					</button>
					{#each series as s}
						<button
							type="button"
							class="w-full text-left px-2 py-1.5 rounded text-sm transition-colors truncate"
							style="color: {selectedSeries === s.id ? 'var(--accent)' : 'var(--text-secondary)'}; background-color: {selectedSeries === s.id ? 'var(--bg-hover)' : 'transparent'};"
							onclick={() => applyFilter('series', s.id)}
						>
							{s.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</aside>
