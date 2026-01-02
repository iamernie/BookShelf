<script lang="ts">
	import { X, Tag, CheckCircle, Trash2, SquareCheck, Square, MoreHorizontal, Users, Mic, Library, Layers, BookOpen, Check, ChevronDown } from 'lucide-svelte';
	import { selectedBooks, selectionCount, hasSelection, selectedIds } from '$lib/stores/selection';
	import { toasts } from '$lib/stores/toast';

	interface Option {
		id: number;
		name?: string;
		title?: string;
	}

	let {
		totalCount,
		onAddTags,
		onChangeStatus,
		onDelete,
		onSelectAll,
		onClearSelection,
		onComplete,
		// Options for inline dropdowns
		authors = [],
		narrators = [],
		series = [],
		formats = [],
		genres = []
	}: {
		totalCount: number;
		onAddTags: () => void;
		onChangeStatus: () => void;
		onDelete: () => void;
		onSelectAll: () => void;
		onClearSelection: () => void;
		onComplete?: () => void;
		authors?: Option[];
		narrators?: Option[];
		series?: Option[];
		formats?: Option[];
		genres?: Option[];
	} = $props();

	let count = $derived($selectionCount);
	let visible = $derived($hasSelection);
	let allSelected = $derived(count === totalCount && totalCount > 0);
	let showMoreMenu = $state(false);

	// Active dropdown state
	let activeDropdown = $state<'author' | 'narrator' | 'series' | 'format' | 'genre' | null>(null);
	let saving = $state(false);
	let searchQuery = $state('');

	// Check if any extended options are available
	let hasExtendedOptions = $derived(
		authors.length > 0 || narrators.length > 0 || series.length > 0 || formats.length > 0 || genres.length > 0
	);

	// Get filtered options based on search
	function getFilteredOptions(options: Option[]): Option[] {
		if (!searchQuery) return options;
		const query = searchQuery.toLowerCase();
		return options.filter(opt => {
			const name = opt.name || opt.title || '';
			return name.toLowerCase().includes(query);
		});
	}

	// Get current options and API endpoint based on active dropdown
	let currentOptions = $derived.by(() => {
		switch (activeDropdown) {
			case 'author': return getFilteredOptions(authors);
			case 'narrator': return getFilteredOptions(narrators);
			case 'series': return getFilteredOptions(series);
			case 'format': return getFilteredOptions(formats);
			case 'genre': return getFilteredOptions(genres);
			default: return [];
		}
	});

	function getApiEndpoint(type: string): string {
		switch (type) {
			case 'author': return '/api/books/bulk/authors';
			case 'narrator': return '/api/books/bulk/narrator';
			case 'series': return '/api/books/bulk/series';
			case 'format': return '/api/books/bulk/format';
			case 'genre': return '/api/books/bulk/genre';
			default: return '';
		}
	}

	function getLabel(type: string): string {
		switch (type) {
			case 'author': return 'Author';
			case 'narrator': return 'Narrator';
			case 'series': return 'Series';
			case 'format': return 'Format';
			case 'genre': return 'Genre';
			default: return '';
		}
	}

	function openDropdown(type: 'author' | 'narrator' | 'series' | 'format' | 'genre') {
		showMoreMenu = false;
		activeDropdown = type;
		searchQuery = '';
	}

	function closeDropdown() {
		activeDropdown = null;
		searchQuery = '';
	}

	async function selectOption(option: Option) {
		if (!activeDropdown || saving) return;

		saving = true;
		const endpoint = getApiEndpoint(activeDropdown);
		const label = getLabel(activeDropdown);
		const bookIds = $selectedIds;

		try {
			const body: Record<string, any> = { bookIds };

			// Different field names for different endpoints
			switch (activeDropdown) {
				case 'author':
					body.authorId = option.id;
					body.action = 'add';
					break;
				case 'narrator':
					body.narratorId = option.id;
					break;
				case 'series':
					body.seriesId = option.id;
					body.action = 'add';
					break;
				case 'format':
					body.formatId = option.id;
					break;
				case 'genre':
					body.genreId = option.id;
					break;
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || `Failed to update ${label.toLowerCase()}`);
			}

			const result = await response.json();
			toasts.success(`${label} updated for ${result.updated || bookIds.length} books`);
			closeDropdown();
			onComplete?.();
		} catch (err) {
			toasts.error(err instanceof Error ? err.message : `Failed to update ${label.toLowerCase()}`);
		} finally {
			saving = false;
		}
	}
</script>

{#if visible}
	<div
		class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-slide-up"
		style="background-color: var(--bg-secondary); border-color: var(--border-color);"
	>
		<!-- Selection count -->
		<div class="flex items-center gap-2 pr-3 border-r" style="border-color: var(--border-color);">
			<span class="font-medium" style="color: var(--text-primary);">
				{count} selected
			</span>
			<button
				type="button"
				class="p-1 rounded hover:bg-black/10 transition-colors"
				style="color: var(--text-muted);"
				onclick={onClearSelection}
				title="Clear selection"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<!-- Select All / Deselect All -->
		<button
			type="button"
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
			style="color: var(--text-secondary);"
			onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
			onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
			onclick={allSelected ? onClearSelection : onSelectAll}
		>
			{#if allSelected}
				<Square class="w-4 h-4" />
				Deselect All
			{:else}
				<SquareCheck class="w-4 h-4" />
				Select All ({totalCount})
			{/if}
		</button>

		<!-- Divider -->
		<div class="w-px h-6" style="background-color: var(--border-color);"></div>

		<!-- Add Tags -->
		<button
			type="button"
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
			style="color: var(--text-secondary);"
			onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
			onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
			onclick={onAddTags}
		>
			<Tag class="w-4 h-4" />
			Tags
		</button>

		<!-- Change Status -->
		<button
			type="button"
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
			style="color: var(--text-secondary);"
			onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
			onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
			onclick={onChangeStatus}
		>
			<CheckCircle class="w-4 h-4" />
			Status
		</button>

		<!-- More Options -->
		{#if hasExtendedOptions}
			<div class="relative">
				<button
					type="button"
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
					style="color: var(--text-secondary); background-color: {showMoreMenu ? 'var(--bg-hover)' : 'transparent'};"
					onmouseenter={(e) => { if (!showMoreMenu) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
					onmouseleave={(e) => { if (!showMoreMenu) e.currentTarget.style.backgroundColor = 'transparent'; }}
					onclick={() => showMoreMenu = !showMoreMenu}
				>
					<MoreHorizontal class="w-4 h-4" />
					More
				</button>

				<!-- Dropdown Menu -->
				{#if showMoreMenu}
					<!-- Backdrop to close menu -->
					<button
						type="button"
						class="fixed inset-0 z-40"
						onclick={() => showMoreMenu = false}
						aria-label="Close menu"
					></button>

					<div
						class="absolute bottom-full left-0 mb-2 w-48 rounded-lg shadow-xl border py-1 z-50"
						style="background-color: var(--bg-secondary); border-color: var(--border-color);"
					>
						{#if authors.length > 0}
							<button
								type="button"
								class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors"
								style="color: var(--text-secondary);"
								onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
								onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
								onclick={() => openDropdown('author')}
							>
								<Users class="w-4 h-4" />
								Set Author
							</button>
						{/if}
						{#if narrators.length > 0}
							<button
								type="button"
								class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors"
								style="color: var(--text-secondary);"
								onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
								onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
								onclick={() => openDropdown('narrator')}
							>
								<Mic class="w-4 h-4" />
								Set Narrator
							</button>
						{/if}
						{#if series.length > 0}
							<button
								type="button"
								class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors"
								style="color: var(--text-secondary);"
								onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
								onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
								onclick={() => openDropdown('series')}
							>
								<Library class="w-4 h-4" />
								Set Series
							</button>
						{/if}
						{#if formats.length > 0}
							<button
								type="button"
								class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors"
								style="color: var(--text-secondary);"
								onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
								onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
								onclick={() => openDropdown('format')}
							>
								<Layers class="w-4 h-4" />
								Set Format
							</button>
						{/if}
						{#if genres.length > 0}
							<button
								type="button"
								class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors"
								style="color: var(--text-secondary);"
								onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
								onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
								onclick={() => openDropdown('genre')}
							>
								<BookOpen class="w-4 h-4" />
								Set Genre
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Divider before delete -->
		<div class="w-px h-6" style="background-color: var(--border-color);"></div>

		<!-- Delete -->
		<button
			type="button"
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium text-red-500 hover:text-red-600"
			onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
			onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
			onclick={onDelete}
		>
			<Trash2 class="w-4 h-4" />
			Delete
		</button>
	</div>

	<!-- Inline Dropdown Selector -->
	{#if activeDropdown}
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 z-50 bg-black/20"
			onclick={closeDropdown}
			aria-label="Close dropdown"
		></button>

		<!-- Dropdown Panel -->
		<div
			class="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-72 rounded-xl shadow-2xl border overflow-hidden"
			style="background-color: var(--bg-secondary); border-color: var(--border-color);"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b" style="border-color: var(--border-color);">
				<span class="font-medium" style="color: var(--text-primary);">
					Set {getLabel(activeDropdown)}
				</span>
				<button
					type="button"
					class="p-1 rounded hover:bg-black/10 transition-colors"
					style="color: var(--text-muted);"
					onclick={closeDropdown}
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Search -->
			<div class="px-3 py-2 border-b" style="border-color: var(--border-color);">
				<input
					type="text"
					placeholder="Search..."
					bind:value={searchQuery}
					class="w-full px-3 py-2 text-sm rounded-lg border"
					style="background-color: var(--bg-tertiary); border-color: var(--border-color); color: var(--text-primary);"
				/>
			</div>

			<!-- Options List -->
			<div class="max-h-64 overflow-y-auto">
				{#if currentOptions.length === 0}
					<div class="px-4 py-6 text-center text-sm" style="color: var(--text-muted);">
						{searchQuery ? 'No matches found' : 'No options available'}
					</div>
				{:else}
					{#each currentOptions as option (option.id)}
						<button
							type="button"
							class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
							style="color: var(--text-secondary);"
							onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
							onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
							onclick={() => selectOption(option)}
							disabled={saving}
						>
							{option.name || option.title}
						</button>
					{/each}
				{/if}
			</div>

			<!-- Loading indicator -->
			{#if saving}
				<div class="absolute inset-0 flex items-center justify-center bg-black/20">
					<div class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<style>
	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.animate-slide-up {
		animation: slide-up 0.2s ease-out;
	}
</style>
