<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Search, Plus, Tag } from 'lucide-svelte';
	import TagCard from '$lib/components/tag/TagCard.svelte';
	import TagModal from '$lib/components/tag/TagModal.svelte';
	import { toasts } from '$lib/stores/toast';

	interface TagWithCount {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
		isSystem: boolean | null;
		bookCount: number;
		seriesCount: number;
		createdAt: string | null;
		updatedAt: string | null;
	}

	interface TagColor {
		name: string;
		value: string;
	}

	let tags = $state<TagWithCount[]>([]);
	let colors = $state<TagColor[]>([]);
	let loading = $state(true);
	let search = $state('');
	let total = $state(0);

	// Modal state - only for adding new tags
	let showAddModal = $state(false);

	async function loadTags() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (search) params.set('search', search);

			const response = await fetch(`/api/tags?${params}`);
			if (!response.ok) throw new Error('Failed to load tags');

			const data = await response.json();
			tags = data.items;
			total = data.total;
			colors = data.colors;
		} catch (err) {
			console.error('Error loading tags:', err);
			toasts.error('Failed to load tags');
		} finally {
			loading = false;
		}
	}

	function openTag(tag: TagWithCount) {
		// Navigate to the edit page instead of modal
		const returnUrl = encodeURIComponent($page.url.pathname + $page.url.search);
		goto(`/tags/${tag.id}/edit?returnTo=${returnUrl}`);
	}

	function openAddModal() {
		showAddModal = true;
	}

	async function saveNewTag(data: { name?: string; color?: string; icon?: string | null }) {
		const response = await fetch('/api/tags', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to save tag');
		}

		toasts.success('Tag created');
		showAddModal = false;
		await loadTags();
	}

	function handleSearch() {
		loadTags();
	}

	onMount(() => {
		loadTags();
	});
</script>

<svelte:head>
	<title>Tags - BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
				<Tag class="w-7 h-7" />
				Tags
			</h1>
			<p class="mt-1" style="color: var(--text-muted);">{total} tags</p>
		</div>

		<button
			type="button"
			class="btn-accent flex items-center gap-2"
			onclick={openAddModal}
		>
			<Plus class="w-5 h-5" />
			Add Tag
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
					placeholder="Search tags..."
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

	<!-- Tags Grid -->
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else if tags.length === 0}
		<div class="text-center py-12">
			<Tag class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="text-lg font-medium mb-2" style="color: var(--text-primary);">No tags found</h3>
			<p class="mb-4" style="color: var(--text-muted);">
				{search ? 'Try a different search term' : 'Get started by creating your first tag'}
			</p>
			{#if !search}
				<button
					type="button"
					class="btn-accent inline-flex items-center gap-2"
					onclick={openAddModal}
				>
					<Plus class="w-5 h-5" />
					Add Tag
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each tags as tag (tag.id)}
				<TagCard {tag} onclick={() => openTag(tag)} />
			{/each}
		</div>
	{/if}
</div>

<!-- Tag Modal - only for adding -->
{#if showAddModal}
	<TagModal
		tag={null}
		books={[]}
		series={[]}
		{colors}
		mode="add"
		onClose={() => showAddModal = false}
		onSave={saveNewTag}
	/>
{/if}
