<script lang="ts">
	import { Plus, Wand2 } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import ShelfCard from '$lib/components/shelves/ShelfCard.svelte';
	import ShelfModal from '$lib/components/shelves/ShelfModal.svelte';
	import type { FilterConfig } from '$lib/server/services/magicShelfService';

	interface Shelf {
		id: number;
		name: string;
		description: string | null;
		icon: string | null;
		iconColor: string | null;
		filterJson: FilterConfig;
		sortField: string;
		sortOrder: string;
		isPublic: boolean;
		bookCount: number;
	}

	let { data } = $props();

	let shelves = $state<Shelf[]>([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingShelf = $state<Shelf | null>(null);

	async function loadShelves() {
		loading = true;
		try {
			const res = await fetch('/api/shelves');
			if (res.ok) {
				shelves = await res.json();
			}
		} catch (e) {
			toasts.error('Failed to load collections');
		} finally {
			loading = false;
		}
	}

	function handleCreate() {
		editingShelf = null;
		showModal = true;
	}

	function handleEdit(shelf: Shelf) {
		editingShelf = shelf;
		showModal = true;
	}

	async function handleDelete(shelf: Shelf) {
		if (!confirm(`Are you sure you want to delete "${shelf.name}"?`)) {
			return;
		}

		try {
			const res = await fetch(`/api/shelves/${shelf.id}`, { method: 'DELETE' });
			if (res.ok) {
				toasts.success('Collection deleted');
				loadShelves();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to delete collection');
			}
		} catch (e) {
			toasts.error('Failed to delete collection');
		}
	}

	function handleModalClose() {
		showModal = false;
		editingShelf = null;
	}

	function handleModalSave() {
		showModal = false;
		editingShelf = null;
		loadShelves();
	}

	// Load shelves on mount
	$effect(() => {
		loadShelves();
	});
</script>

<svelte:head>
	<title>Smart Collections | BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
				<Wand2 class="w-7 h-7" style="color: var(--accent);" />
				Smart Collections
			</h1>
			<p class="text-sm mt-1" style="color: var(--text-muted);">
				Create smart collections that automatically update based on your rules
			</p>
		</div>
		<button
			type="button"
			class="btn-accent px-4 py-2 flex items-center gap-2"
			onclick={handleCreate}
		>
			<Plus class="w-4 h-4" />
			New Collection
		</button>
	</div>

	<!-- Shelves Grid -->
	{#if loading}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each Array(6) as _}
				<div
					class="h-32 rounded-xl animate-pulse"
					style="background-color: var(--bg-secondary);"
				></div>
			{/each}
		</div>
	{:else if shelves.length === 0}
		<div
			class="text-center py-16 rounded-xl border"
			style="background-color: var(--bg-secondary); border-color: var(--border-color);"
		>
			<Wand2 class="w-16 h-16 mx-auto mb-4" style="color: var(--text-muted);" />
			<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">
				No Smart Collections Yet
			</h2>
			<p class="mb-6" style="color: var(--text-muted);">
				Create your first smart collection to organize your books automatically.
			</p>
			<button
				type="button"
				class="btn-accent px-6 py-2 inline-flex items-center gap-2"
				onclick={handleCreate}
			>
				<Plus class="w-4 h-4" />
				Create Your First Collection
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each shelves as shelf (shelf.id)}
				<ShelfCard
					{shelf}
					onEdit={handleEdit}
					onDelete={handleDelete}
				/>
			{/each}
		</div>
	{/if}
</div>

{#if showModal}
	<ShelfModal
		shelf={editingShelf ? {
			id: editingShelf.id,
			name: editingShelf.name,
			description: editingShelf.description || '',
			icon: editingShelf.icon || 'bookmark',
			iconColor: editingShelf.iconColor || '#6c757d',
			filterJson: editingShelf.filterJson,
			sortField: editingShelf.sortField,
			sortOrder: editingShelf.sortOrder,
			isPublic: editingShelf.isPublic
		} : null}
		statuses={data.statuses}
		genres={data.genres}
		formats={data.formats}
		authors={data.authors}
		series={data.series}
		tags={data.tags}
		narrators={data.narrators}
		onClose={handleModalClose}
		onSave={handleModalSave}
	/>
{/if}
