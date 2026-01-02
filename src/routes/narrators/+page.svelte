<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search, Plus, Mic } from 'lucide-svelte';
	import NarratorCard from '$lib/components/narrator/NarratorCard.svelte';
	import NarratorModal from '$lib/components/narrator/NarratorModal.svelte';
	import { toasts } from '$lib/stores/toast';

	interface TagInfo {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	}

	interface NarratorWithStats {
		id: number;
		name: string;
		bio: string | null;
		photoUrl: string | null;
		audiobookCount: number;
		bookCount: number;
		avgRating: number | null;
		coverBook?: { id: number; title: string; coverImageUrl: string | null } | null;
		tags?: TagInfo[];
		createdAt: string | null;
		updatedAt: string | null;
	}

	let narrators = $state<NarratorWithStats[]>([]);
	let loading = $state(true);
	let search = $state('');
	let total = $state(0);

	// Modal state - only for adding new narrators
	let showAddModal = $state(false);

	async function loadNarrators() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (search) params.set('search', search);
			params.set('includeStats', 'true');

			const response = await fetch(`/api/narrators?${params}`);
			if (!response.ok) throw new Error('Failed to load narrators');

			const data = await response.json();
			narrators = data.items;
			total = data.total;
		} catch (err) {
			console.error('Error loading narrators:', err);
			toasts.error('Failed to load narrators');
		} finally {
			loading = false;
		}
	}

	function openNarrator(narrator: NarratorWithStats) {
		// Navigate to the detail page
		goto(`/narrators/${narrator.id}`);
	}

	function openAddModal() {
		showAddModal = true;
	}

	async function saveNewNarrator(data: { name: string; bio?: string | null; url?: string | null }) {
		const response = await fetch('/api/narrators', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to save narrator');
		}

		toasts.success('Narrator created');
		showAddModal = false;
		await loadNarrators();
	}

	function handleSearch() {
		loadNarrators();
	}

	onMount(() => {
		loadNarrators();
	});
</script>

<svelte:head>
	<title>Narrators - BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
				<Mic class="w-7 h-7" />
				Narrators
			</h1>
			<p class="mt-1" style="color: var(--text-muted);">{total} narrators</p>
		</div>

		<button
			type="button"
			class="btn-accent flex items-center gap-2"
			onclick={openAddModal}
		>
			<Plus class="w-5 h-5" />
			Add Narrator
		</button>
	</div>

	<!-- Search -->
	<div class="mb-6">
		<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="flex gap-2">
			<div class="relative flex-1 max-w-md">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style="color: var(--text-muted);" />
				<input
					type="text"
					bind:value={search}
					placeholder="Search narrators..."
					class="input w-full pl-10"
				/>
			</div>
			<button
				type="submit"
				class="btn-secondary"
			>
				Search
			</button>
		</form>
	</div>

	<!-- Narrators Grid -->
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else if narrators.length === 0}
		<div class="text-center py-12">
			<Mic class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="text-lg font-medium mb-2" style="color: var(--text-primary);">No narrators found</h3>
			<p class="mb-4" style="color: var(--text-muted);">
				{search ? 'Try a different search term' : 'Get started by creating your first narrator'}
			</p>
			{#if !search}
				<button
					type="button"
					class="btn-accent inline-flex items-center gap-2"
					onclick={openAddModal}
				>
					<Plus class="w-5 h-5" />
					Add Narrator
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each narrators as narrator (narrator.id)}
				<NarratorCard {narrator} onclick={() => openNarrator(narrator)} />
			{/each}
		</div>
	{/if}
</div>

<!-- Narrator Modal - only for adding -->
{#if showAddModal}
	<NarratorModal
		narrator={null}
		books={[]}
		mode="add"
		onClose={() => showAddModal = false}
		onSave={saveNewNarrator}
	/>
{/if}
