<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search, Plus, Folder } from 'lucide-svelte';
	import GenreCard from '$lib/components/genre/GenreCard.svelte';
	import GenreModal from '$lib/components/genre/GenreModal.svelte';
	import { toasts } from '$lib/stores/toast';

	interface GenreWithStats {
		id: number;
		name: string;
		description: string | null;
		color: string | null;
		icon: string | null;
		displayOrder: number | null;
		slug: string | null;
		bookCount: number;
		avgRating: number | null;
		createdAt: string | null;
		updatedAt: string | null;
	}

	let genres = $state<GenreWithStats[]>([]);
	let loading = $state(true);
	let search = $state('');
	let total = $state(0);

	// Modal state - only for adding new genres
	let showAddModal = $state(false);

	async function loadGenres() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (search) params.set('search', search);

			const response = await fetch(`/api/genres?${params}`);
			if (!response.ok) throw new Error('Failed to load genres');

			const data = await response.json();
			genres = data.items;
			total = data.total;
		} catch (err) {
			console.error('Error loading genres:', err);
			toasts.error('Failed to load genres');
		} finally {
			loading = false;
		}
	}

	function openGenre(genre: GenreWithStats) {
		// Navigate to the edit page instead of modal
		const returnUrl = encodeURIComponent($page.url.pathname + $page.url.search);
		goto(`/genres/${genre.id}/edit?returnTo=${returnUrl}`);
	}

	function openAddModal() {
		showAddModal = true;
	}

	async function saveNewGenre(data: { name: string; description?: string | null; color?: string | null; icon?: string | null; displayOrder?: number }) {
		const response = await fetch('/api/genres', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to save genre');
		}

		toasts.success('Genre created');
		showAddModal = false;
		await loadGenres();
	}

	function handleSearch() {
		loadGenres();
	}

	onMount(() => {
		loadGenres();
	});
</script>

<svelte:head>
	<title>Genres - BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
				<Folder class="w-7 h-7" />
				Genres
			</h1>
			<p class="mt-1" style="color: var(--text-muted);">{total} genres</p>
		</div>

		<button
			type="button"
			class="btn-accent flex items-center gap-2"
			onclick={openAddModal}
		>
			<Plus class="w-5 h-5" />
			Add Genre
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
					placeholder="Search genres..."
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

	<!-- Genres Grid -->
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else if genres.length === 0}
		<div class="text-center py-12">
			<Folder class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="text-lg font-medium mb-2" style="color: var(--text-primary);">No genres found</h3>
			<p class="mb-4" style="color: var(--text-muted);">
				{search ? 'Try a different search term' : 'Get started by creating your first genre'}
			</p>
			{#if !search}
				<button
					type="button"
					class="btn-accent inline-flex items-center gap-2"
					onclick={openAddModal}
				>
					<Plus class="w-5 h-5" />
					Add Genre
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each genres as genre (genre.id)}
				<GenreCard {genre} onclick={() => openGenre(genre)} />
			{/each}
		</div>
	{/if}
</div>

<!-- Genre Modal - only for adding -->
{#if showAddModal}
	<GenreModal
		genre={null}
		books={[]}
		mode="add"
		onClose={() => showAddModal = false}
		onSave={saveNewGenre}
	/>
{/if}
