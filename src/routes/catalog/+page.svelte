<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Users,
		FolderOpen,
		Tag,
		Library,
		Mic,
		Layers,
		ListChecks,
		Search,
		Plus,
		Trash2,
		GitMerge,
		ChevronLeft,
		ChevronRight,
		Check,
		X,
		Download,
		MoreHorizontal,
		Edit,
		Eye,
		Pencil
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import AuthorModal from '$lib/components/author/AuthorModal.svelte';
	import GenreModal from '$lib/components/genre/GenreModal.svelte';
	import TagModal from '$lib/components/tag/TagModal.svelte';
	import SeriesModal from '$lib/components/series/SeriesModal.svelte';
	import NarratorModal from '$lib/components/narrator/NarratorModal.svelte';
	import FormatModal from '$lib/components/format/FormatModal.svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import BulkEditModal from '$lib/components/bulk/BulkEditModal.svelte';

	// Generic catalog item type
	interface CatalogItem {
		id: number;
		name?: string;
		title?: string;
		color?: string | null;
		icon?: string | null;
		bookCount?: number;
		seriesCount?: number;
		avgRating?: number | null;
		averageRating?: number | null;
		authorName?: string;
		[key: string]: unknown;
	}

	let { data } = $props();

	// Cast items to proper type
	let items = $derived(data.items as CatalogItem[]);

	// Tab definitions
	const tabs = [
		{ id: 'authors', label: 'Authors', icon: Users },
		{ id: 'series', label: 'Series', icon: Library },
		{ id: 'genres', label: 'Genres', icon: FolderOpen },
		{ id: 'tags', label: 'Tags', icon: Tag },
		{ id: 'narrators', label: 'Narrators', icon: Mic },
		{ id: 'formats', label: 'Formats', icon: Layers },
		{ id: 'statuses', label: 'Statuses', icon: ListChecks }
	];

	// State
	let searchInput = $state(data.search);
	let selectedIds = $state<Set<number>>(new Set());
	let showAddModal = $state(false);
	let showMergeConfirm = $state(false);
	let showDeleteConfirm = $state(false);
	let showBulkEditModal = $state(false);
	let bulkEditBookIds = $state<number[]>([]);
	let bulkEditLoading = $state(false);
	let editItem = $state<any>(null);
	let viewItem = $state<any>(null);
	let itemDetails = $state<any>(null);

	// Computed
	let allSelected = $derived(
		items.length > 0 && selectedIds.size === items.length
	);
	let someSelected = $derived(selectedIds.size > 0);
	let totalPages = $derived(Math.ceil(data.total / data.limit));

	// Column definitions per entity type
	const columnDefs: Record<string, { key: string; label: string; width?: string }[]> = {
		authors: [
			{ key: 'name', label: 'Name' },
			{ key: 'bookCount', label: 'Books', width: '80px' },
			{ key: 'avgRating', label: 'Avg Rating', width: '100px' }
		],
		series: [
			{ key: 'title', label: 'Title' },
			{ key: 'bookCount', label: 'Books', width: '80px' },
			{ key: 'authorName', label: 'Author' }
		],
		genres: [
			{ key: 'name', label: 'Name' },
			{ key: 'bookCount', label: 'Books', width: '80px' },
			{ key: 'color', label: 'Color', width: '80px' }
		],
		tags: [
			{ key: 'name', label: 'Name' },
			{ key: 'bookCount', label: 'Books', width: '80px' },
			{ key: 'seriesCount', label: 'Series', width: '80px' },
			{ key: 'color', label: 'Color', width: '80px' }
		],
		narrators: [
			{ key: 'name', label: 'Name' },
			{ key: 'bookCount', label: 'Books', width: '80px' }
		],
		formats: [
			{ key: 'name', label: 'Name' },
			{ key: 'bookCount', label: 'Books', width: '80px' },
			{ key: 'icon', label: 'Icon', width: '80px' }
		],
		statuses: [
			{ key: 'name', label: 'Name' },
			{ key: 'bookCount', label: 'Books', width: '80px' },
			{ key: 'color', label: 'Color', width: '80px' }
		]
	};

	let columns = $derived(columnDefs[data.tab] || []);

	// Functions
	function switchTab(tabId: string) {
		selectedIds = new Set();
		goto(`/catalog?tab=${tabId}`);
	}

	function handleSearch() {
		const params = new URLSearchParams();
		params.set('tab', data.tab);
		if (searchInput) params.set('search', searchInput);
		goto(`/catalog?${params.toString()}`);
	}

	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`/catalog?${params.toString()}`);
	}

	function toggleSelect(id: number) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(items.map((item) => item.id));
		}
	}

	function getDisplayValue(item: any, key: string): string {
		const value = item[key];
		if (value === null || value === undefined) return '-';
		if (key === 'avgRating' || key === 'averageRating') {
			return value ? `${Number(value).toFixed(1)}` : '-';
		}
		if (key === 'color') {
			return ''; // Will render as color swatch
		}
		if (key === 'icon') {
			return ''; // Will render as icon
		}
		return String(value);
	}

	function getNameField(item: any): string {
		return item.name || item.title || 'Unknown';
	}

	async function openItem(item: any) {
		viewItem = item;
		// Fetch details based on entity type
		try {
			const endpoint = getApiEndpoint(data.tab);
			const response = await fetch(`${endpoint}/${item.id}`);
			if (response.ok) {
				itemDetails = await response.json();
			}
		} catch (err) {
			console.error('Failed to load details:', err);
		}
	}

	function editItemFn(item: CatalogItem) {
		// Navigate to the entity's dedicated edit page with return URL
		const returnUrl = encodeURIComponent($page.url.pathname + $page.url.search);
		const editUrls: Record<string, string> = {
			authors: `/authors/${item.id}/edit`,
			series: `/series/${item.id}/edit`,
			genres: `/genres/${item.id}/edit`,
			tags: `/tags/${item.id}/edit`,
			narrators: `/narrators/${item.id}/edit`,
			formats: `/formats/${item.id}/edit`
		};

		const url = editUrls[data.tab];
		if (url) {
			goto(`${url}?returnTo=${returnUrl}`);
		}
	}

	function getApiEndpoint(tab: string): string {
		const endpoints: Record<string, string> = {
			authors: '/api/authors',
			series: '/api/series',
			genres: '/api/genres',
			tags: '/api/tags',
			narrators: '/api/narrators',
			formats: '/api/formats',
			statuses: '/api/statuses'
		};
		return endpoints[tab] || '/api/authors';
	}

	async function handleSave(itemData: any) {
		const endpoint = getApiEndpoint(data.tab);
		const isEdit = editItem !== null;
		const url = isEdit ? `${endpoint}/${editItem.id}` : endpoint;
		const method = isEdit ? 'PUT' : 'POST';

		try {
			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(itemData)
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Failed to save');
			}

			toasts.success(isEdit ? `${getEntityLabel()} updated` : `${getEntityLabel()} created`);
			showAddModal = false;
			editItem = null;
			// Refresh
			goto($page.url.href, { invalidateAll: true });
		} catch (err: any) {
			toasts.error(err.message || 'Failed to save');
			throw err;
		}
	}

	async function handleBulkDelete() {
		if (selectedIds.size === 0) return;

		const endpoint = getApiEndpoint(data.tab);
		let successCount = 0;
		let failCount = 0;

		for (const id of selectedIds) {
			try {
				const response = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
				if (response.ok) {
					successCount++;
				} else {
					failCount++;
				}
			} catch {
				failCount++;
			}
		}

		if (successCount > 0) {
			toasts.success(`Deleted ${successCount} ${getEntityLabel(successCount !== 1)}`.toLowerCase());
		}
		if (failCount > 0) {
			toasts.error(`Failed to delete ${failCount} items`);
		}

		selectedIds = new Set();
		showDeleteConfirm = false;
		goto($page.url.href, { invalidateAll: true });
	}

	async function handleMerge() {
		if (selectedIds.size < 2) {
			toasts.error('Select at least 2 items to merge');
			return;
		}

		const ids = Array.from(selectedIds);
		const primaryId = ids[0];
		const mergeIds = ids.slice(1);

		try {
			const response = await fetch(`/api/catalog/merge`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entityType: data.tab,
					primaryId,
					mergeIds
				})
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Failed to merge');
			}

			const result = await response.json();
			toasts.success(`Merged ${mergeIds.length} items into "${result.name}"`);
			selectedIds = new Set();
			showMergeConfirm = false;
			goto($page.url.href, { invalidateAll: true });
		} catch (err: any) {
			toasts.error(err.message || 'Failed to merge');
		}
	}

	function getEntityLabel(plural = false): string {
		const labels: Record<string, [string, string]> = {
			authors: ['Author', 'Authors'],
			series: ['Series', 'Series'],
			genres: ['Genre', 'Genres'],
			tags: ['Tag', 'Tags'],
			narrators: ['Narrator', 'Narrators'],
			formats: ['Format', 'Formats'],
			statuses: ['Status', 'Statuses']
		};
		const [singular, pluralLabel] = labels[data.tab] || ['Item', 'Items'];
		return plural ? pluralLabel : singular;
	}

	function canMerge(): boolean {
		// Statuses can't be merged (system defined)
		return data.tab !== 'statuses' && selectedIds.size >= 2;
	}

	function canDelete(): boolean {
		// Statuses can't be deleted
		return data.tab !== 'statuses' && selectedIds.size > 0;
	}

	function canAdd(): boolean {
		// Statuses can't be added
		return data.tab !== 'statuses';
	}

	function exportData() {
		const endpoint = getApiEndpoint(data.tab);
		window.open(`${endpoint}/export`, '_blank');
	}

	async function openBulkEdit() {
		if (selectedIds.size === 0) return;

		bulkEditLoading = true;
		try {
			// Get book IDs for selected entities
			const response = await fetch('/api/catalog/books', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entityType: data.tab,
					entityIds: Array.from(selectedIds)
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get books');
			}

			const result = await response.json();
			if (result.bookIds.length === 0) {
				toasts.warning('No books found for selected items');
				return;
			}

			bulkEditBookIds = result.bookIds;
			showBulkEditModal = true;
		} catch (err) {
			toasts.error('Failed to load books for editing');
		} finally {
			bulkEditLoading = false;
		}
	}

	function handleBulkEditComplete() {
		showBulkEditModal = false;
		bulkEditBookIds = [];
		selectedIds = new Set();
		goto($page.url.href, { invalidateAll: true });
	}

	function canBulkEdit(): boolean {
		// Can bulk edit books from any entity type
		return selectedIds.size > 0;
	}

	function getSelectedBookCount(): number {
		// Sum of book counts for selected items
		return Array.from(selectedIds).reduce((sum, id) => {
			const item = items.find((i) => i.id === id);
			return sum + (item?.bookCount || 0);
		}, 0);
	}
</script>

<svelte:head>
	<title>Catalog Manager - BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
			<Library class="w-7 h-7" style="color: var(--accent);" />
			Catalog Manager
		</h1>
		<p class="text-sm mt-1" style="color: var(--text-muted);">
			Manage your library's metadata in one place
		</p>
	</div>

	<!-- Tabs -->
	<div class="flex flex-wrap gap-1 mb-6 p-1 rounded-lg" style="background-color: var(--bg-tertiary);">
		{#each tabs as tab}
			{@const Icon = tab.icon}
			<button
				type="button"
				class="tab-button"
				class:active={data.tab === tab.id}
				onclick={() => switchTab(tab.id)}
			>
				<Icon class="w-4 h-4" />
				<span class="hidden sm:inline">{tab.label}</span>
			</button>
		{/each}
	</div>

	<!-- Toolbar -->
	<div class="flex flex-col sm:flex-row gap-4 mb-4">
		<!-- Search -->
		<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="flex-1">
			<div class="relative max-w-md">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color: var(--text-muted);" />
				<input
					type="text"
					placeholder="Search {getEntityLabel(true).toLowerCase()}..."
					bind:value={searchInput}
					class="input pl-10"
				/>
			</div>
		</form>

		<!-- Actions -->
		<div class="flex items-center gap-2">
			{#if someSelected}
				<span class="text-sm" style="color: var(--text-muted);">
					{selectedIds.size} selected
					{#if getSelectedBookCount() > 0}
						<span class="text-xs">({getSelectedBookCount()} books)</span>
					{/if}
				</span>
				{#if canBulkEdit() && getSelectedBookCount() > 0}
					<button
						type="button"
						class="btn-accent btn-sm"
						onclick={openBulkEdit}
						disabled={bulkEditLoading}
						title="Edit books for selected items"
					>
						{#if bulkEditLoading}
							<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
						{:else}
							<Pencil class="w-4 h-4" />
						{/if}
						<span class="hidden sm:inline">Edit Books</span>
					</button>
				{/if}
				{#if canMerge()}
					<button
						type="button"
						class="btn-secondary btn-sm"
						onclick={() => showMergeConfirm = true}
						title="Merge selected"
					>
						<GitMerge class="w-4 h-4" />
						<span class="hidden sm:inline">Merge</span>
					</button>
				{/if}
				{#if canDelete()}
					<button
						type="button"
						class="btn-danger btn-sm"
						onclick={() => showDeleteConfirm = true}
						title="Delete selected"
					>
						<Trash2 class="w-4 h-4" />
						<span class="hidden sm:inline">Delete</span>
					</button>
				{/if}
				<button
					type="button"
					class="btn-ghost btn-sm"
					onclick={() => selectedIds = new Set()}
				>
					<X class="w-4 h-4" />
				</button>
			{:else}
				<button
					type="button"
					class="btn-secondary btn-sm"
					onclick={exportData}
					title="Export"
				>
					<Download class="w-4 h-4" />
				</button>
				{#if canAdd()}
					<button
						type="button"
						class="btn-accent"
						onclick={() => { editItem = null; showAddModal = true; }}
					>
						<Plus class="w-4 h-4" />
						<span class="hidden sm:inline">Add {getEntityLabel()}</span>
					</button>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Table -->
	<div class="card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr style="background-color: var(--bg-tertiary);">
						<th class="table-header w-10">
							<input
								type="checkbox"
								checked={allSelected}
								onchange={toggleSelectAll}
								class="checkbox"
							/>
						</th>
						{#each columns as col}
							<th class="table-header" style:width={col.width}>
								{col.label}
							</th>
						{/each}
						<th class="table-header w-20">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#if items.length === 0}
						<tr>
							<td colspan={columns.length + 2} class="text-center py-12" style="color: var(--text-muted);">
								{#if data.search}
									No {getEntityLabel(true).toLowerCase()} matching "{data.search}"
								{:else}
									No {getEntityLabel(true).toLowerCase()} yet
								{/if}
							</td>
						</tr>
					{:else}
						{#each items as item (item.id)}
							<tr
								class="table-row"
								class:selected={selectedIds.has(item.id)}
							>
								<td class="table-cell w-10">
									<input
										type="checkbox"
										checked={selectedIds.has(item.id)}
										onchange={() => toggleSelect(item.id)}
										class="checkbox"
									/>
								</td>
								{#each columns as col}
									<td class="table-cell" style:width={col.width}>
										{#if col.key === 'color' && item.color}
											<span
												class="w-6 h-6 rounded-full inline-block border"
												style="background-color: {item.color}; border-color: var(--border-color);"
											></span>
										{:else if col.key === 'icon' && item.icon}
											<DynamicIcon icon={item.icon} size={20} color={item.color || 'var(--text-muted)'} />
										{:else if col.key === 'name' || col.key === 'title'}
											<button
												type="button"
												class="font-medium hover:underline text-left"
												style="color: var(--accent);"
												onclick={() => openItem(item)}
											>
												{getNameField(item)}
											</button>
										{:else}
											{getDisplayValue(item, col.key)}
										{/if}
									</td>
								{/each}
								<td class="table-cell w-20">
									<div class="flex items-center gap-1">
										<button
											type="button"
											class="icon-btn"
											onclick={() => openItem(item)}
											title="View"
										>
											<Eye class="w-4 h-4" />
										</button>
										{#if data.tab !== 'statuses'}
											<button
												type="button"
												class="icon-btn"
												onclick={() => editItemFn(item)}
												title="Edit"
											>
												<Edit class="w-4 h-4" />
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-between px-4 py-3 border-t" style="border-color: var(--border-color);">
				<span class="text-sm" style="color: var(--text-muted);">
					Showing {((data.page - 1) * data.limit) + 1} - {Math.min(data.page * data.limit, data.total)} of {data.total}
				</span>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="pagination-btn"
						disabled={data.page <= 1}
						onclick={() => goToPage(data.page - 1)}
					>
						<ChevronLeft class="w-4 h-4" />
					</button>
					<span class="text-sm" style="color: var(--text-muted);">
						Page {data.page} of {totalPages}
					</span>
					<button
						type="button"
						class="pagination-btn"
						disabled={data.page >= totalPages}
						onclick={() => goToPage(data.page + 1)}
					>
						<ChevronRight class="w-4 h-4" />
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Summary -->
	<div class="mt-4 text-sm" style="color: var(--text-muted);">
		Total: {data.total} {getEntityLabel(data.total !== 1).toLowerCase()}
	</div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
	<div class="modal-backdrop" onclick={() => showDeleteConfirm = false}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">
				Delete {selectedIds.size} {getEntityLabel(selectedIds.size !== 1)}?
			</h3>
			<p class="mb-6" style="color: var(--text-secondary);">
				This will remove the selected items. Books associated with these items will have their references cleared.
			</p>
			<div class="flex justify-end gap-3">
				<button type="button" class="btn-secondary" onclick={() => showDeleteConfirm = false}>
					Cancel
				</button>
				<button type="button" class="btn-danger" onclick={handleBulkDelete}>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Merge Confirmation Modal -->
{#if showMergeConfirm}
	<div class="modal-backdrop" onclick={() => showMergeConfirm = false}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">
				Merge {selectedIds.size} {getEntityLabel(selectedIds.size !== 1)}?
			</h3>
			<p class="mb-4" style="color: var(--text-secondary);">
				All items will be merged into the first selected item. Books from other items will be reassigned.
			</p>
			<div class="mb-6 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
				<p class="text-sm font-medium" style="color: var(--text-primary);">
					Primary: {getNameField(items.find((i) => i.id === Array.from(selectedIds)[0]))}
				</p>
				<p class="text-xs mt-1" style="color: var(--text-muted);">
					{selectedIds.size - 1} other items will be merged into this one
				</p>
			</div>
			<div class="flex justify-end gap-3">
				<button type="button" class="btn-secondary" onclick={() => showMergeConfirm = false}>
					Cancel
				</button>
				<button type="button" class="btn-accent" onclick={handleMerge}>
					<GitMerge class="w-4 h-4" />
					Merge
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Entity Modals -->
{#if showAddModal && data.tab === 'authors'}
	<AuthorModal
		author={editItem}
		mode={editItem ? 'edit' : 'add'}
		onClose={() => { showAddModal = false; editItem = null; }}
		onSave={handleSave}
	/>
{/if}

{#if showAddModal && data.tab === 'genres'}
	<GenreModal
		genre={editItem}
		books={[]}
		mode={editItem ? 'edit' : 'add'}
		onClose={() => { showAddModal = false; editItem = null; }}
		onSave={handleSave}
	/>
{/if}

{#if showAddModal && data.tab === 'tags'}
	<TagModal
		tag={editItem}
		books={[]}
		series={[]}
		colors={[]}
		mode={editItem ? 'edit' : 'add'}
		onClose={() => { showAddModal = false; editItem = null; }}
		onSave={handleSave}
	/>
{/if}

{#if showAddModal && data.tab === 'series'}
	<SeriesModal
		series={editItem}
		mode={editItem ? 'edit' : 'add'}
		onClose={() => { showAddModal = false; editItem = null; }}
		onSave={handleSave}
	/>
{/if}

{#if showAddModal && data.tab === 'narrators'}
	<NarratorModal
		narrator={editItem}
		books={[]}
		mode={editItem ? 'edit' : 'add'}
		onClose={() => { showAddModal = false; editItem = null; }}
		onSave={handleSave}
	/>
{/if}

{#if showAddModal && data.tab === 'formats'}
	<FormatModal
		format={editItem}
		books={[]}
		mode={editItem ? 'edit' : 'add'}
		onClose={() => { showAddModal = false; editItem = null; }}
		onSave={handleSave}
	/>
{/if}

<!-- Bulk Edit Modal -->
{#if showBulkEditModal}
	<BulkEditModal
		bookIds={bulkEditBookIds}
		onClose={() => { showBulkEditModal = false; bulkEditBookIds = []; }}
		onComplete={handleBulkEditComplete}
	/>
{/if}

<style>
	.tab-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab-button:hover {
		background-color: var(--bg-hover);
		color: var(--text-primary);
	}

	.tab-button.active {
		background-color: var(--bg-secondary);
		color: var(--accent);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.table-header {
		padding: 0.75rem 1rem;
		text-align: left;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.table-row {
		border-bottom: 1px solid var(--border-subtle);
		transition: background-color 0.15s;
	}

	.table-row:hover {
		background-color: var(--bg-tertiary);
	}

	.table-row.selected {
		background-color: var(--bg-tertiary);
	}

	.table-cell {
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.checkbox {
		width: 1rem;
		height: 1rem;
		border-radius: 0.25rem;
		border: 1px solid var(--border-color);
		background-color: var(--bg-secondary);
		cursor: pointer;
	}

	.checkbox:checked {
		background-color: var(--accent);
		border-color: var(--accent);
	}

	.icon-btn {
		padding: 0.375rem;
		border-radius: 0.375rem;
		color: var(--text-muted);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.15s;
	}

	.icon-btn:hover {
		background-color: var(--bg-hover);
		color: var(--text-primary);
	}

	.btn-sm {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
	}

	.btn-danger {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: #dc2626;
		color: white;
		border-radius: 0.5rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-danger:hover {
		background-color: #b91c1c;
	}

	.pagination-btn {
		padding: 0.375rem;
		border-radius: 0.375rem;
		background-color: var(--bg-secondary);
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
		cursor: pointer;
		transition: all 0.15s;
	}

	.pagination-btn:hover:not(:disabled) {
		background-color: var(--bg-hover);
		color: var(--text-primary);
	}

	.pagination-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
	}

	.modal-content {
		background-color: var(--bg-secondary);
		border-radius: 0.75rem;
		padding: 1.5rem;
		max-width: 28rem;
		width: 90%;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	}
</style>
