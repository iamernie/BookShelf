<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import SeriesCard from '$lib/components/series/SeriesCard.svelte';
	import SeriesModal from '$lib/components/series/SeriesModal.svelte';
	import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import type { Series } from '$lib/server/db/schema';

	let { data } = $props();

	let searchInput = $state(data.search);
	let showAddModal = $state(false);

	let totalPages = $derived(Math.ceil(data.total / data.limit));

	// Check for open parameter and redirect to detail page
	onMount(() => {
		const openId = $page.url.searchParams.get('open');
		if (openId) {
			goto(`/series/${openId}`);
		}
	});

	function handleSearch() {
		const params = new URLSearchParams($page.url.searchParams);
		if (searchInput) {
			params.set('search', searchInput);
		} else {
			params.delete('search');
		}
		params.delete('page');
		goto(`/series?${params.toString()}`);
	}

	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`/series?${params.toString()}`);
	}

	function openSeries(seriesItem: { id: number }) {
		goto(`/series/${seriesItem.id}`);
	}

	async function handleSave(seriesData: Partial<Series>) {
		const res = await fetch('/api/series', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(seriesData)
		});
		if (res.ok) {
			const newSeries = await res.json();
			toasts.success('Series created');
			showAddModal = false;
			// Navigate to the new series page
			goto(`/series/${newSeries.id}`);
		} else {
			const err = await res.json();
			toasts.error(err.message || 'Failed to create series');
			throw new Error(err.message);
		}
	}
</script>

<svelte:head>
	<title>Series - BookShelf</title>
</svelte:head>

<div class="page-container">
	<!-- Header -->
	<div class="page-header">
		<h1 class="page-title">Series</h1>

		<div class="header-actions">
			<!-- Search -->
			<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="search-form">
				<Search class="search-icon" />
				<input
					type="text"
					placeholder="Search series..."
					bind:value={searchInput}
					class="search-input"
				/>
			</form>

			<!-- Add button -->
			<button
				type="button"
				class="btn-primary"
				onclick={() => (showAddModal = true)}
			>
				<Plus class="w-4 h-4" />
				Add Series
			</button>
		</div>
	</div>

	<!-- Results info -->
	<p class="results-info">
		{data.total} {data.total === 1 ? 'series' : 'series'}
		{#if data.search}
			matching "{data.search}"
		{/if}
	</p>

	<!-- Series grid -->
	{#if data.items.length > 0}
		<div class="series-grid">
			{#each data.items as seriesItem (seriesItem.id)}
				<SeriesCard series={seriesItem} onclick={() => openSeries(seriesItem)} />
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="pagination">
				<button
					type="button"
					class="pagination-btn"
					disabled={data.page <= 1}
					onclick={() => goToPage(data.page - 1)}
				>
					<ChevronLeft class="w-5 h-5" />
				</button>

				<span class="pagination-info">
					Page {data.page} of {totalPages}
				</span>

				<button
					type="button"
					class="pagination-btn"
					disabled={data.page >= totalPages}
					onclick={() => goToPage(data.page + 1)}
				>
					<ChevronRight class="w-5 h-5" />
				</button>
			</div>
		{/if}
	{:else}
		<div class="empty-state">
			{#if data.search}
				No series found matching "{data.search}"
			{:else}
				No series yet. Add your first series!
			{/if}
		</div>
	{/if}
</div>

<style>
	.page-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.page-header {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	@media (min-width: 640px) {
		.page-header {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.search-form {
		position: relative;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		width: 1rem;
		height: 1rem;
		color: var(--text-muted);
	}

	.search-input {
		padding: 0.5rem 1rem 0.5rem 2.5rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		color: var(--text-primary);
		width: 16rem;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
	}

	.btn-primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: var(--accent);
		color: white;
		border-radius: 0.5rem;
		font-weight: 500;
		transition: opacity 0.2s;
		border: none;
		cursor: pointer;
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.results-info {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-bottom: 1rem;
	}

	.series-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.series-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.series-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (min-width: 1280px) {
		.series-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 2rem;
	}

	.pagination-btn {
		padding: 0.5rem;
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		color: var(--text-primary);
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.pagination-btn:hover:not(:disabled) {
		background-color: var(--bg-hover);
	}

	.pagination-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pagination-info {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.empty-state {
		text-align: center;
		padding: 3rem 0;
		color: var(--text-muted);
	}
</style>

<!-- Add Series Modal -->
{#if showAddModal}
	<SeriesModal
		series={null}
		mode="add"
		onClose={() => (showAddModal = false)}
		onSave={handleSave}
	/>
{/if}
