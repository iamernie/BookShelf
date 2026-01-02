<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import AuthorCard from '$lib/components/author/AuthorCard.svelte';
	import AuthorModal from '$lib/components/author/AuthorModal.svelte';
	import { Search, Plus, ChevronLeft, ChevronRight, Download, Users } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import type { Author } from '$lib/server/db/schema';

	interface AuthorWithStats {
		id: number;
		name: string;
		photoUrl: string | null;
		bookCount: number;
		readCount?: number;
		averageRating?: number | null;
		completionPercentage?: number;
		inferredGenre?: { id: number; name: string; color: string | null } | null;
		coverBook?: { id: number; title: string; coverUrl: string | null } | null;
	}

	let { data } = $props();

	let searchInput = $state(data.search);
	let showAddModal = $state(false);

	let totalPages = $derived(Math.ceil(data.total / data.limit));

	function handleSearch() {
		const params = new URLSearchParams($page.url.searchParams);
		if (searchInput) {
			params.set('search', searchInput);
		} else {
			params.delete('search');
		}
		params.delete('page');
		goto(`/authors?${params.toString()}`);
	}

	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`/authors?${params.toString()}`);
	}

	function openAuthor(author: AuthorWithStats) {
		goto(`/authors/${author.id}`);
	}

	function exportAuthors() {
		window.open('/api/authors/export', '_blank');
	}

	async function handleSave(authorData: Partial<Author>) {
		const res = await fetch('/api/authors', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(authorData)
		});
		if (res.ok) {
			const newAuthor = await res.json();
			toasts.success('Author created');
			showAddModal = false;
			// Navigate to the new author page
			goto(`/authors/${newAuthor.id}`);
		} else {
			const err = await res.json();
			toasts.error(err.message || 'Failed to create author');
			throw new Error(err.message);
		}
	}
</script>

<svelte:head>
	<title>Authors - BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
				<Users class="w-7 h-7" style="color: var(--accent);" />
				Authors
			</h1>
			<p class="text-sm mt-1" style="color: var(--text-muted);">
				{data.total} {data.total === 1 ? 'author' : 'authors'}
				{#if data.search}
					matching "{data.search}"
				{/if}
			</p>
		</div>

		<div class="flex items-center gap-3">
			<!-- Search -->
			<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="relative">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color: var(--text-muted);" />
				<input
					type="text"
					placeholder="Search authors..."
					bind:value={searchInput}
					class="search-input"
				/>
			</form>

			<!-- Export button -->
			<button
				type="button"
				class="btn-secondary"
				onclick={exportAuthors}
				title="Export to CSV"
			>
				<Download class="w-4 h-4" />
			</button>

			<!-- Add button -->
			<button
				type="button"
				class="btn-accent"
				onclick={() => (showAddModal = true)}
			>
				<Plus class="w-4 h-4" />
				<span class="hidden sm:inline">Add Author</span>
			</button>
		</div>
	</div>

	<!-- Authors grid -->
	{#if data.items.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each data.items as author (author.id)}
				<AuthorCard {author} onclick={() => openAuthor(author)} />
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2 mt-8">
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
			<Users class="w-16 h-16 mx-auto mb-4" style="color: var(--text-muted);" />
			{#if data.search}
				<h2 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
					No authors found
				</h2>
				<p style="color: var(--text-muted);">
					No authors matching "{data.search}"
				</p>
			{:else}
				<h2 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
					No authors yet
				</h2>
				<p class="mb-4" style="color: var(--text-muted);">
					Add your first author to get started
				</p>
				<button
					type="button"
					class="btn-accent"
					onclick={() => (showAddModal = true)}
				>
					<Plus class="w-4 h-4" />
					Add Author
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.search-input {
		padding: 0.5rem 0.75rem 0.5rem 2.5rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		color: var(--text-primary);
		width: 16rem;
		font-size: 0.875rem;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.1);
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.btn-accent {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: var(--accent);
		color: white;
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.2s;
		border: none;
	}

	.btn-accent:hover {
		background-color: var(--accent-hover);
	}

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background-color: var(--bg-secondary);
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-secondary:hover {
		background-color: var(--bg-hover);
		color: var(--text-primary);
	}

	.pagination-btn {
		padding: 0.5rem;
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
		cursor: pointer;
		transition: all 0.2s;
	}

	.pagination-btn:hover:not(:disabled) {
		background-color: var(--bg-hover);
		color: var(--text-primary);
	}

	.pagination-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pagination-info {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background-color: var(--bg-secondary);
		border-radius: 0.75rem;
		border: 1px solid var(--border-color);
	}
</style>

<!-- Add Author Modal -->
{#if showAddModal}
	<AuthorModal
		author={null}
		mode="add"
		onClose={() => (showAddModal = false)}
		onSave={handleSave}
	/>
{/if}
