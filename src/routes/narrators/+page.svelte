<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import { Search, Plus, Mic, ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import NarratorCard from '$lib/components/narrator/NarratorCard.svelte';
	import NarratorRow from '$lib/components/narrator/NarratorRow.svelte';
	import NarratorModal from '$lib/components/narrator/NarratorModal.svelte';
	import ListHeader from '$lib/components/ui/ListHeader.svelte';
	import SortSelect from '$lib/components/ui/SortSelect.svelte';
	import ViewToggle from '$lib/components/ui/ViewToggle.svelte';
	import PageSizeSelect from '$lib/components/ui/PageSizeSelect.svelte';
	import { toasts } from '$lib/stores/toast';
	import { BROWSE_SURFACES, applySort, nextSort, saveBrowsePrefs, type BrowseView, type SortOrder } from '$lib/utils/browse';

	let { data } = $props();

	// Seeded for the server render; the $effect below keeps it in step on Back and other navigations
	let searchInput = $state(untrack(() => data.search));
	// Starts in the saved view; toggling saves it without navigating
	let viewMode = $state<BrowseView>(untrack(() => data.view));

	// Modal state - only for adding new narrators
	let showAddModal = $state(false);

	// Keep the box in step with the URL, including Back
	$effect(() => {
		searchInput = data.search;
	});

	let totalPages = $derived(Math.ceil(data.total / data.limit));

	function navigate(params: URLSearchParams) {
		const qs = params.toString();
		goto(qs ? `/narrators?${qs}` : '/narrators');
	}

	function handleSearch() {
		const params = new URLSearchParams($page.url.searchParams);
		if (searchInput) {
			params.set('search', searchInput);
		} else {
			params.delete('search');
		}
		params.delete('page');
		navigate(params);
	}

	function clearTag() {
		const params = new URLSearchParams($page.url.searchParams);
		params.delete('tag');
		params.delete('page');
		navigate(params);
	}

	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		navigate(params);
	}

	function applySortChoice(sort: string, order: SortOrder) {
		saveBrowsePrefs('narrators', { sort, order });
		const params = new URLSearchParams($page.url.searchParams);
		applySort(params, sort, order);
		navigate(params);
	}

	function handleSort(field: string) {
		const next = nextSort('narrators', { sort: data.sort, order: data.order }, field);
		applySortChoice(next.sort, next.order);
	}

	function setView(view: BrowseView) {
		viewMode = view;
		saveBrowsePrefs('narrators', { view });
	}

	function setLimit(limit: number) {
		saveBrowsePrefs('narrators', { limit });
		const params = new URLSearchParams($page.url.searchParams);
		params.set('limit', String(limit));
		params.delete('page');
		navigate(params);
	}

	function openNarrator(narrator: { id: number }) {
		goto(`/narrators/${narrator.id}`);
	}

	async function saveNewNarrator(narratorData: { name: string; bio?: string | null; url?: string | null }) {
		const response = await fetch('/api/narrators', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(narratorData)
		});

		if (!response.ok) {
			const error = await response.json();
			// A near-duplicate already exists: open that narrator instead of failing
			if (response.status === 409 && error.existing) {
				toasts.info(`Using existing narrator "${error.existing.name}"`);
				showAddModal = false;
				await goto(`/narrators/${error.existing.id}`);
				return;
			}
			throw new Error(error.message || 'Failed to save narrator');
		}

		toasts.success('Narrator created');
		showAddModal = false;
		await invalidateAll();
	}
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
			<p class="mt-1" style="color: var(--text-muted);">
				{data.total} {data.total === 1 ? 'narrator' : 'narrators'}
				{#if data.search}
					matching "{data.search}"
				{/if}
			</p>
		</div>

		<button
			type="button"
			class="btn-accent flex items-center gap-2"
			onclick={() => (showAddModal = true)}
		>
			<Plus class="w-5 h-5" />
			Add Narrator
		</button>
	</div>

	<!-- Search, then view, sort and page size -->
	<div class="flex flex-wrap items-center gap-2 mb-6">
		<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="flex gap-2 flex-1 min-w-[16rem]">
			<div class="relative flex-1 max-w-md">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style="color: var(--text-muted);" />
				<input
					type="text"
					bind:value={searchInput}
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

		{#if data.tag}
			<button type="button" class="btn-ghost flex items-center gap-1 text-sm" onclick={clearTag} title="Clear tag filter">
				Tag: {data.tag.name}
				<X class="w-3.5 h-3.5" />
			</button>
		{/if}

		<div class="flex flex-wrap items-center gap-2">
			<SortSelect surface="narrators" sort={data.sort} order={data.order} label="Sort narrators by" onchange={applySortChoice} />
			<ViewToggle view={viewMode} views={BROWSE_SURFACES.narrators.views} onchange={setView} />
			<PageSizeSelect surface="narrators" limit={data.limit} onchange={setLimit} />
		</div>
	</div>

	<!-- Narrators list or grid -->
	{#if data.items.length === 0}
		<div class="text-center py-12">
			<Mic class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="text-lg font-medium mb-2" style="color: var(--text-primary);">No narrators found</h3>
			<p class="mb-4" style="color: var(--text-muted);">
				{data.search || data.tag ? 'Try a different search term' : 'Get started by creating your first narrator'}
			</p>
			{#if !data.search && !data.tag}
				<button
					type="button"
					class="btn-accent inline-flex items-center gap-2"
					onclick={() => (showAddModal = true)}
				>
					<Plus class="w-5 h-5" />
					Add Narrator
				</button>
			{/if}
		</div>
	{:else}
		{#if viewMode === 'list'}
			<div class="card overflow-hidden">
				<ListHeader gridClass="list-grid-narrators" columns={BROWSE_SURFACES.narrators.columns} sortField={data.sort} sortOrder={data.order} onSort={handleSort} />
				<ul class="divide-y" style="border-color: var(--border-color);" data-sveltekit-preload-data="tap">
					{#each data.items as narrator (narrator.id)}
						<NarratorRow {narrator} />
					{/each}
				</ul>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each data.items as narrator (narrator.id)}
					<NarratorCard {narrator} onclick={() => openNarrator(narrator)} />
				{/each}
			</div>
		{/if}

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2 mt-8">
				<button
					type="button"
					class="btn-ghost p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={data.page <= 1}
					onclick={() => goToPage(data.page - 1)}
					aria-label="Previous page"
				>
					<ChevronLeft class="w-5 h-5" />
				</button>

				<span class="px-4 py-2 text-sm" style="color: var(--text-secondary);">
					Page {data.page} of {totalPages}
				</span>

				<button
					type="button"
					class="btn-ghost p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={data.page >= totalPages}
					onclick={() => goToPage(data.page + 1)}
					aria-label="Next page"
				>
					<ChevronRight class="w-5 h-5" />
				</button>
			</div>
		{/if}
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
