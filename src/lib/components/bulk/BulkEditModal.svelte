<script lang="ts">
	import { X, Edit, Mic, Layers, Tag, BookOpen, Library, Users, CheckCircle, Plus, Minus } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	type EditField = 'narrator' | 'format' | 'genre' | 'status' | 'tags' | 'series' | 'author';

	interface Option {
		id: number;
		name?: string;
		title?: string;
		color?: string | null;
		icon?: string | null;
	}

	let {
		bookIds,
		onClose,
		onComplete
	}: {
		bookIds: number[];
		onClose: () => void;
		onComplete: () => void;
	} = $props();

	// Active tab
	let activeField = $state<EditField>('status');

	// Options data - loaded on mount
	let narrators = $state<Option[]>([]);
	let formats = $state<Option[]>([]);
	let genres = $state<Option[]>([]);
	let statuses = $state<Option[]>([]);
	let tags = $state<Option[]>([]);
	let series = $state<Option[]>([]);
	let authors = $state<Option[]>([]);

	// Selection states
	let selectedNarratorId = $state<number | null>(null);
	let selectedFormatId = $state<number | null>(null);
	let selectedGenreId = $state<number | null>(null);
	let selectedStatusId = $state<number | null>(null);
	let selectedTagIds = $state<Set<number>>(new Set());
	let selectedSeriesId = $state<number | null>(null);
	let selectedAuthorId = $state<number | null>(null);
	let tagMode = $state<'add' | 'remove'>('add');
	let seriesAction = $state<'add' | 'remove' | 'clear'>('add');
	let authorAction = $state<'add' | 'remove' | 'clear'>('add');

	let loading = $state(false);
	let dataLoading = $state(true);

	// Tab definitions
	const tabs: { id: EditField; label: string; icon: typeof Edit }[] = [
		{ id: 'status', label: 'Status', icon: CheckCircle },
		{ id: 'tags', label: 'Tags', icon: Tag },
		{ id: 'genre', label: 'Genre', icon: BookOpen },
		{ id: 'format', label: 'Format', icon: Layers },
		{ id: 'narrator', label: 'Narrator', icon: Mic },
		{ id: 'series', label: 'Series', icon: Library },
		{ id: 'author', label: 'Author', icon: Users }
	];

	// Load all options on mount
	$effect(() => {
		loadOptions();
	});

	async function loadOptions() {
		dataLoading = true;
		try {
			const [narratorRes, formatRes, genreRes, statusRes, tagRes, seriesRes, authorRes] = await Promise.all([
				fetch('/api/narrators'),
				fetch('/api/formats'),
				fetch('/api/genres'),
				fetch('/api/statuses'),
				fetch('/api/tags'),
				fetch('/api/series'),
				fetch('/api/authors')
			]);

			if (narratorRes.ok) {
				const data = await narratorRes.json();
				narrators = data.items || data;
			}
			if (formatRes.ok) {
				const data = await formatRes.json();
				formats = data.items || data;
			}
			if (genreRes.ok) {
				const data = await genreRes.json();
				genres = data.items || data;
			}
			if (statusRes.ok) {
				statuses = await statusRes.json();
			}
			if (tagRes.ok) {
				const data = await tagRes.json();
				tags = data.items || data;
			}
			if (seriesRes.ok) {
				const data = await seriesRes.json();
				series = data.items || data;
			}
			if (authorRes.ok) {
				const data = await authorRes.json();
				authors = data.items || data;
			}
		} catch (err) {
			console.error('Failed to load options:', err);
			toasts.error('Failed to load options');
		} finally {
			dataLoading = false;
		}
	}

	function toggleTag(tagId: number) {
		const newSet = new Set(selectedTagIds);
		if (newSet.has(tagId)) {
			newSet.delete(tagId);
		} else {
			newSet.add(tagId);
		}
		selectedTagIds = newSet;
	}

	async function handleSubmit() {
		loading = true;
		try {
			let endpoint = '';
			let payload: Record<string, unknown> = { bookIds };

			switch (activeField) {
				case 'narrator':
					endpoint = '/api/books/bulk/narrator';
					payload.narratorId = selectedNarratorId;
					break;
				case 'format':
					endpoint = '/api/books/bulk/format';
					payload.formatId = selectedFormatId;
					break;
				case 'genre':
					endpoint = '/api/books/bulk/genre';
					payload.genreId = selectedGenreId;
					break;
				case 'status':
					if (selectedStatusId === null) {
						toasts.warning('Please select a status');
						loading = false;
						return;
					}
					endpoint = '/api/books/bulk/status';
					payload.statusId = selectedStatusId;
					break;
				case 'tags':
					if (selectedTagIds.size === 0) {
						toasts.warning('Please select at least one tag');
						loading = false;
						return;
					}
					endpoint = '/api/books/bulk/tags';
					payload.tagIds = Array.from(selectedTagIds);
					payload.action = tagMode;
					break;
				case 'series':
					endpoint = '/api/books/bulk/series';
					payload.seriesId = selectedSeriesId;
					payload.action = seriesAction;
					break;
				case 'author':
					endpoint = '/api/books/bulk/authors';
					payload.authorId = selectedAuthorId;
					payload.action = authorAction;
					break;
			}

			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				const result = await res.json();
				toasts.success(result.message || `Updated ${bookIds.length} book(s)`);
				onComplete();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to update books');
			}
		} catch (e) {
			toasts.error('Failed to update books');
		} finally {
			loading = false;
		}
	}

	function getButtonLabel(): string {
		switch (activeField) {
			case 'narrator':
				return selectedNarratorId ? 'Set Narrator' : 'Clear Narrator';
			case 'format':
				return selectedFormatId ? 'Set Format' : 'Clear Format';
			case 'genre':
				return selectedGenreId ? 'Set Genre' : 'Clear Genre';
			case 'status':
				return 'Set Status';
			case 'tags':
				return `${tagMode === 'add' ? 'Add' : 'Remove'} ${selectedTagIds.size} Tag${selectedTagIds.size !== 1 ? 's' : ''}`;
			case 'series':
				if (seriesAction === 'clear') return 'Clear All Series';
				return `${seriesAction === 'add' ? 'Add to' : 'Remove from'} Series`;
			case 'author':
				if (authorAction === 'clear') return 'Clear All Authors';
				return `${authorAction === 'add' ? 'Add' : 'Remove'} Author`;
			default:
				return 'Apply';
		}
	}

	function canSubmit(): boolean {
		switch (activeField) {
			case 'narrator':
			case 'format':
			case 'genre':
				return true; // Can clear
			case 'status':
				return selectedStatusId !== null;
			case 'tags':
				return selectedTagIds.size > 0;
			case 'series':
				return seriesAction === 'clear' || selectedSeriesId !== null;
			case 'author':
				return authorAction === 'clear' || selectedAuthorId !== null;
			default:
				return false;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	role="dialog"
	aria-modal="true"
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<!-- Backdrop -->
	<button
		type="button"
		class="absolute inset-0 bg-black/50"
		onclick={onClose}
		aria-label="Close modal"
	></button>

	<!-- Modal -->
	<div
		class="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl border flex flex-col"
		style="background-color: var(--bg-secondary); border-color: var(--border-color);"
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b shrink-0" style="border-color: var(--border-color);">
			<div class="flex items-center gap-2">
				<Edit class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					Bulk Edit {bookIds.length} Book{bookIds.length !== 1 ? 's' : ''}
				</h2>
			</div>
			<button
				type="button"
				class="p-1 rounded hover:bg-black/10 transition-colors"
				style="color: var(--text-muted);"
				onclick={onClose}
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<!-- Tabs -->
		<div class="flex border-b px-4 overflow-x-auto shrink-0" style="border-color: var(--border-color);">
			{#each tabs as tab}
				{@const Icon = tab.icon}
				<button
					type="button"
					class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
					style="
						border-color: {activeField === tab.id ? 'var(--accent)' : 'transparent'};
						color: {activeField === tab.id ? 'var(--accent)' : 'var(--text-muted)'};
					"
					onclick={() => activeField = tab.id}
				>
					<Icon class="w-4 h-4" />
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Content -->
		<div class="p-4 overflow-y-auto flex-1">
			{#if dataLoading}
				<div class="flex items-center justify-center py-8">
					<div class="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style="border-color: var(--accent);"></div>
				</div>
			{:else if activeField === 'status'}
				<p class="text-sm mb-4" style="color: var(--text-secondary);">
					Select a status to apply:
				</p>
				<div class="grid grid-cols-2 gap-2">
					{#each statuses as status (status.id)}
						<button
							type="button"
							class="flex items-center gap-3 p-3 rounded-lg border transition-all text-left"
							style="
								border-color: {selectedStatusId === status.id ? status.color || 'var(--accent)' : 'var(--border-color)'};
								background-color: {selectedStatusId === status.id ? (status.color ? status.color + '15' : 'var(--accent-muted)') : 'transparent'};
							"
							onclick={() => selectedStatusId = status.id}
						>
							<div
								class="w-4 h-4 rounded-full shrink-0"
								style="background-color: {status.color || '#6c757d'};"
							></div>
							<span
								class="font-medium"
								style="color: {selectedStatusId === status.id ? 'var(--text-primary)' : 'var(--text-secondary)'};"
							>
								{status.name}
							</span>
						</button>
					{/each}
				</div>

			{:else if activeField === 'tags'}
				<!-- Mode Toggle -->
				<div class="flex rounded-lg p-1 mb-4" style="background-color: var(--bg-tertiary);">
					<button
						type="button"
						class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors"
						style="background-color: {tagMode === 'add' ? 'var(--bg-secondary)' : 'transparent'}; color: {tagMode === 'add' ? 'var(--accent)' : 'var(--text-muted)'};"
						onclick={() => tagMode = 'add'}
					>
						<Plus class="w-4 h-4" />
						Add Tags
					</button>
					<button
						type="button"
						class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors"
						style="background-color: {tagMode === 'remove' ? 'var(--bg-secondary)' : 'transparent'}; color: {tagMode === 'remove' ? 'var(--accent)' : 'var(--text-muted)'};"
						onclick={() => tagMode = 'remove'}
					>
						<Minus class="w-4 h-4" />
						Remove Tags
					</button>
				</div>
				<div class="grid grid-cols-3 gap-2">
					{#each tags as tag (tag.id)}
						<button
							type="button"
							class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
							style="
								border-color: {selectedTagIds.has(tag.id) ? tag.color || 'var(--accent)' : 'var(--border-color)'};
								background-color: {selectedTagIds.has(tag.id) ? (tag.color ? tag.color + '20' : 'var(--accent-muted)') : 'transparent'};
							"
							onclick={() => toggleTag(tag.id)}
						>
							<div
								class="w-3 h-3 rounded-full shrink-0"
								style="background-color: {tag.color || '#6c757d'};"
							></div>
							<span
								class="text-sm truncate"
								style="color: {selectedTagIds.has(tag.id) ? 'var(--text-primary)' : 'var(--text-secondary)'};"
							>
								{tag.name}
							</span>
						</button>
					{/each}
				</div>

			{:else if activeField === 'genre'}
				<p class="text-sm mb-4" style="color: var(--text-secondary);">
					Select a genre to set, or leave empty to clear:
				</p>
				<div class="grid grid-cols-3 gap-2">
					<button
						type="button"
						class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
						style="
							border-color: {selectedGenreId === null ? 'var(--accent)' : 'var(--border-color)'};
							background-color: {selectedGenreId === null ? 'var(--accent-muted)' : 'transparent'};
						"
						onclick={() => selectedGenreId = null}
					>
						<X class="w-3 h-3 shrink-0" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: {selectedGenreId === null ? 'var(--text-primary)' : 'var(--text-muted)'};">
							Clear Genre
						</span>
					</button>
					{#each genres as genre (genre.id)}
						<button
							type="button"
							class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
							style="
								border-color: {selectedGenreId === genre.id ? genre.color || 'var(--accent)' : 'var(--border-color)'};
								background-color: {selectedGenreId === genre.id ? (genre.color ? genre.color + '20' : 'var(--accent-muted)') : 'transparent'};
							"
							onclick={() => selectedGenreId = genre.id}
						>
							<div
								class="w-3 h-3 rounded-full shrink-0"
								style="background-color: {genre.color || '#6c757d'};"
							></div>
							<span
								class="text-sm truncate"
								style="color: {selectedGenreId === genre.id ? 'var(--text-primary)' : 'var(--text-secondary)'};"
							>
								{genre.name}
							</span>
						</button>
					{/each}
				</div>

			{:else if activeField === 'format'}
				<p class="text-sm mb-4" style="color: var(--text-secondary);">
					Select a format to set, or leave empty to clear:
				</p>
				<div class="grid grid-cols-3 gap-2">
					<button
						type="button"
						class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
						style="
							border-color: {selectedFormatId === null ? 'var(--accent)' : 'var(--border-color)'};
							background-color: {selectedFormatId === null ? 'var(--accent-muted)' : 'transparent'};
						"
						onclick={() => selectedFormatId = null}
					>
						<X class="w-3 h-3 shrink-0" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: {selectedFormatId === null ? 'var(--text-primary)' : 'var(--text-muted)'};">
							Clear Format
						</span>
					</button>
					{#each formats as format (format.id)}
						<button
							type="button"
							class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
							style="
								border-color: {selectedFormatId === format.id ? 'var(--accent)' : 'var(--border-color)'};
								background-color: {selectedFormatId === format.id ? 'var(--accent-muted)' : 'transparent'};
							"
							onclick={() => selectedFormatId = format.id}
						>
							<span
								class="text-sm truncate"
								style="color: {selectedFormatId === format.id ? 'var(--text-primary)' : 'var(--text-secondary)'};"
							>
								{format.name}
							</span>
						</button>
					{/each}
				</div>

			{:else if activeField === 'narrator'}
				<p class="text-sm mb-4" style="color: var(--text-secondary);">
					Select a narrator to set, or leave empty to clear:
				</p>
				<div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
					<button
						type="button"
						class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
						style="
							border-color: {selectedNarratorId === null ? 'var(--accent)' : 'var(--border-color)'};
							background-color: {selectedNarratorId === null ? 'var(--accent-muted)' : 'transparent'};
						"
						onclick={() => selectedNarratorId = null}
					>
						<X class="w-3 h-3 shrink-0" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: {selectedNarratorId === null ? 'var(--text-primary)' : 'var(--text-muted)'};">
							Clear Narrator
						</span>
					</button>
					{#each narrators as narrator (narrator.id)}
						<button
							type="button"
							class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
							style="
								border-color: {selectedNarratorId === narrator.id ? 'var(--accent)' : 'var(--border-color)'};
								background-color: {selectedNarratorId === narrator.id ? 'var(--accent-muted)' : 'transparent'};
							"
							onclick={() => selectedNarratorId = narrator.id}
						>
							<Mic class="w-3 h-3 shrink-0" style="color: var(--text-muted);" />
							<span
								class="text-sm truncate"
								style="color: {selectedNarratorId === narrator.id ? 'var(--text-primary)' : 'var(--text-secondary)'};"
							>
								{narrator.name}
							</span>
						</button>
					{/each}
				</div>

			{:else if activeField === 'series'}
				<!-- Action Toggle -->
				<div class="flex rounded-lg p-1 mb-4" style="background-color: var(--bg-tertiary);">
					<button
						type="button"
						class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
						style="background-color: {seriesAction === 'add' ? 'var(--bg-secondary)' : 'transparent'}; color: {seriesAction === 'add' ? 'var(--accent)' : 'var(--text-muted)'};"
						onclick={() => seriesAction = 'add'}
					>
						<Plus class="w-4 h-4" />
						Add to Series
					</button>
					<button
						type="button"
						class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
						style="background-color: {seriesAction === 'remove' ? 'var(--bg-secondary)' : 'transparent'}; color: {seriesAction === 'remove' ? 'var(--accent)' : 'var(--text-muted)'};"
						onclick={() => seriesAction = 'remove'}
					>
						<Minus class="w-4 h-4" />
						Remove from Series
					</button>
					<button
						type="button"
						class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
						style="background-color: {seriesAction === 'clear' ? 'var(--bg-secondary)' : 'transparent'}; color: {seriesAction === 'clear' ? 'var(--accent)' : 'var(--text-muted)'};"
						onclick={() => seriesAction = 'clear'}
					>
						<X class="w-4 h-4" />
						Clear All
					</button>
				</div>

				{#if seriesAction !== 'clear'}
					<p class="text-sm mb-3" style="color: var(--text-secondary);">
						Select a series:
					</p>
					<div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
						{#each series as s (s.id)}
							<button
								type="button"
								class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
								style="
									border-color: {selectedSeriesId === s.id ? 'var(--accent)' : 'var(--border-color)'};
									background-color: {selectedSeriesId === s.id ? 'var(--accent-muted)' : 'transparent'};
								"
								onclick={() => selectedSeriesId = s.id}
							>
								<Library class="w-3 h-3 shrink-0" style="color: var(--text-muted);" />
								<span
									class="text-sm truncate"
									style="color: {selectedSeriesId === s.id ? 'var(--text-primary)' : 'var(--text-secondary)'};"
								>
									{s.name || s.title}
								</span>
							</button>
						{/each}
					</div>
				{:else}
					<div class="p-4 rounded-lg text-center" style="background-color: var(--bg-tertiary);">
						<p class="text-sm" style="color: var(--text-secondary);">
							This will remove all series associations from the selected books.
						</p>
					</div>
				{/if}

			{:else if activeField === 'author'}
				<!-- Action Toggle -->
				<div class="flex rounded-lg p-1 mb-4" style="background-color: var(--bg-tertiary);">
					<button
						type="button"
						class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
						style="background-color: {authorAction === 'add' ? 'var(--bg-secondary)' : 'transparent'}; color: {authorAction === 'add' ? 'var(--accent)' : 'var(--text-muted)'};"
						onclick={() => authorAction = 'add'}
					>
						<Plus class="w-4 h-4" />
						Add Author
					</button>
					<button
						type="button"
						class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
						style="background-color: {authorAction === 'remove' ? 'var(--bg-secondary)' : 'transparent'}; color: {authorAction === 'remove' ? 'var(--accent)' : 'var(--text-muted)'};"
						onclick={() => authorAction = 'remove'}
					>
						<Minus class="w-4 h-4" />
						Remove Author
					</button>
					<button
						type="button"
						class="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors"
						style="background-color: {authorAction === 'clear' ? 'var(--bg-secondary)' : 'transparent'}; color: {authorAction === 'clear' ? 'var(--accent)' : 'var(--text-muted)'};"
						onclick={() => authorAction = 'clear'}
					>
						<X class="w-4 h-4" />
						Clear All
					</button>
				</div>

				{#if authorAction !== 'clear'}
					<p class="text-sm mb-3" style="color: var(--text-secondary);">
						Select an author:
					</p>
					<div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
						{#each authors as author (author.id)}
							<button
								type="button"
								class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
								style="
									border-color: {selectedAuthorId === author.id ? 'var(--accent)' : 'var(--border-color)'};
									background-color: {selectedAuthorId === author.id ? 'var(--accent-muted)' : 'transparent'};
								"
								onclick={() => selectedAuthorId = author.id}
							>
								<Users class="w-3 h-3 shrink-0" style="color: var(--text-muted);" />
								<span
									class="text-sm truncate"
									style="color: {selectedAuthorId === author.id ? 'var(--text-primary)' : 'var(--text-secondary)'};"
								>
									{author.name}
								</span>
							</button>
						{/each}
					</div>
				{:else}
					<div class="p-4 rounded-lg text-center" style="background-color: var(--bg-tertiary);">
						<p class="text-sm" style="color: var(--text-secondary);">
							This will remove all author associations from the selected books.
						</p>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex justify-end gap-3 p-4 border-t shrink-0" style="border-color: var(--border-color);">
			<button
				type="button"
				class="btn-ghost px-4 py-2"
				onclick={onClose}
				disabled={loading}
			>
				Cancel
			</button>
			<button
				type="button"
				class="btn-accent px-4 py-2"
				onclick={handleSubmit}
				disabled={loading || !canSubmit()}
			>
				{#if loading}
					Updating...
				{:else}
					{getButtonLabel()}
				{/if}
			</button>
		</div>
	</div>
</div>
