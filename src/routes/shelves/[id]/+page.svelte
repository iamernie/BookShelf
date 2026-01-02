<script lang="ts">
	import { ArrowLeft, Library, Edit, Settings } from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import BookCard from '$lib/components/book/BookCard.svelte';
	import BookGrid from '$lib/components/book/BookGrid.svelte';
	import ShelfModal from '$lib/components/shelves/ShelfModal.svelte';
	import type { BookCardData } from '$lib/types';
	import type { FilterConfig } from '$lib/server/services/magicShelfService';

	let { data } = $props();

	let showEditModal = $state(false);

	// Transform raw books to BookCardData format
	let books = $derived(data.books.map(book => ({
		id: book.id,
		title: book.title,
		coverImageUrl: book.coverImageUrl,
		rating: book.rating,
		bookNum: book.bookNum,
		ebookPath: book.ebookPath,
		audiobookId: book.audiobookId,
		authorName: null, // TODO: join with authors
		seriesName: null, // TODO: join with series
		status: null, // TODO: join with statuses
		summary: book.summary
	} as BookCardData)));

	function handleBookClick(book: BookCardData) {
		goto(`/books/${book.id}`);
	}

	function changePage(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', newPage.toString());
		goto(url.pathname + url.search);
	}
</script>

<svelte:head>
	<title>{data.shelf.name} | Magic Shelves | BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<!-- Header -->
	<div class="mb-6">
		<button
			type="button"
			onclick={() => history.back()}
			class="inline-flex items-center gap-1 text-sm mb-4 transition-colors hover:opacity-80 bg-transparent border-none cursor-pointer p-0"
			style="color: var(--text-muted);"
		>
			<ArrowLeft class="w-4 h-4" />
			Back
		</button>

		<div class="flex items-start justify-between">
			<div class="flex items-center gap-4">
				<div
					class="w-14 h-14 rounded-xl flex items-center justify-center"
					style="background-color: {data.shelf.iconColor || '#6c757d'}20;"
				>
					<Library
						class="w-7 h-7"
						style="color: {data.shelf.iconColor || '#6c757d'};"
					/>
				</div>
				<div>
					<h1 class="text-2xl font-bold" style="color: var(--text-primary);">
						{data.shelf.name}
					</h1>
					{#if data.shelf.description}
						<p class="mt-1" style="color: var(--text-muted);">
							{data.shelf.description}
						</p>
					{/if}
					<p class="text-sm mt-1" style="color: var(--text-secondary);">
						{data.pagination.total} book{data.pagination.total !== 1 ? 's' : ''}
					</p>
				</div>
			</div>

			<button
				type="button"
				class="btn-ghost p-2 rounded-lg"
				title="Edit shelf"
				onclick={() => showEditModal = true}
			>
				<Settings class="w-5 h-5" />
			</button>
		</div>
	</div>

	<!-- Books Grid -->
	{#if books.length === 0}
		<div
			class="text-center py-16 rounded-xl border"
			style="background-color: var(--bg-secondary); border-color: var(--border-color);"
		>
			<Library class="w-16 h-16 mx-auto mb-4" style="color: var(--text-muted);" />
			<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">
				No Books Match
			</h2>
			<p style="color: var(--text-muted);">
				No books match the current filter rules for this shelf.
			</p>
		</div>
	{:else}
		<BookGrid gap="md">
			{#each books as book (book.id)}
				<BookCard
					{book}
					onClick={handleBookClick}
				/>
			{/each}
		</BookGrid>

		<!-- Pagination -->
		{#if data.pagination.totalPages > 1}
			<div class="flex justify-center items-center gap-2 mt-8">
				<button
					type="button"
					class="btn-ghost px-3 py-1"
					disabled={data.pagination.page <= 1}
					onclick={() => changePage(data.pagination.page - 1)}
				>
					Previous
				</button>

				<span class="px-4 py-1" style="color: var(--text-secondary);">
					Page {data.pagination.page} of {data.pagination.totalPages}
				</span>

				<button
					type="button"
					class="btn-ghost px-3 py-1"
					disabled={data.pagination.page >= data.pagination.totalPages}
					onclick={() => changePage(data.pagination.page + 1)}
				>
					Next
				</button>
			</div>
		{/if}
	{/if}
</div>

{#if showEditModal}
	<ShelfModal
		shelf={{
			id: data.shelf.id,
			name: data.shelf.name,
			description: data.shelf.description || '',
			icon: data.shelf.icon || 'bookmark',
			iconColor: data.shelf.iconColor || '#6c757d',
			filterJson: data.shelf.filterJson as FilterConfig,
			sortField: data.shelf.sortField || 'title',
			sortOrder: data.shelf.sortOrder || 'asc',
			isPublic: Boolean(data.shelf.isPublic)
		}}
		statuses={data.statuses}
		genres={data.genres}
		formats={data.formats}
		authors={data.authors}
		series={data.series}
		tags={data.tags}
		narrators={data.narrators}
		onClose={() => showEditModal = false}
		onSave={() => { showEditModal = false; invalidateAll(); }}
	/>
{/if}
