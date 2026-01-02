<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import BookCard from '$lib/components/book/BookCard.svelte';
	import BookGrid from '$lib/components/book/BookGrid.svelte';
	import BookRow from '$lib/components/book/BookRow.svelte';
	import BookListHeader from '$lib/components/book/BookListHeader.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import EbookUpload from '$lib/components/book/EbookUpload.svelte';
	import { Library, BookOpen, Search, Plus, Check, Grid, List, Upload, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import type { BookCardData } from '$lib/types';

	let { data } = $props();

	// Convert library book to BookCardData for row/card components
	function toBookCardData(book: typeof data.books[0]): BookCardData {
		return {
			id: book.id,
			title: book.title,
			coverImageUrl: book.coverImageUrl,
			rating: book.rating,
			authorName: book.authors[0] || null,
			seriesName: null,
			bookNum: null,
			ebookPath: null,
			status: null,
			genre: book.genreId && book.genreName ? { id: book.genreId, name: book.genreName } : null,
			format: null,
			tags: []
		};
	}

	function handleRowClick(book: BookCardData) {
		goto(`/books/${book.id}`);
	}

	let searchQuery = $state(data.filters.search);
	let viewMode = $state<'grid' | 'list'>('grid');
	let addingBookId = $state<number | null>(null);
	let showUploadModal = $state(false);

	function handleUploadComplete(bookId: number) {
		invalidateAll();
	}

	function closeUploadModal() {
		showUploadModal = false;
		invalidateAll();
	}

	// Filter library tabs based on public library setting
	const libraryTabs = $derived(
		data.publicLibraryEnabled !== false
			? [
					{ value: 'public', label: 'Public Library', icon: Library },
					{ value: 'personal', label: 'Personal', icon: BookOpen },
					{ value: 'all', label: 'All Books', icon: Grid }
				]
			: [
					{ value: 'personal', label: 'My Library', icon: BookOpen }
				]
	);

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams($page.url.searchParams);
		if (searchQuery) {
			params.set('q', searchQuery);
		} else {
			params.delete('q');
		}
		params.set('page', '1');
		goto(`?${params.toString()}`);
	}

	function setLibraryFilter(filter: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('library', filter);
		params.set('page', '1');
		goto(`?${params.toString()}`);
	}

	function setGenreFilter(genreId: number | null) {
		const params = new URLSearchParams($page.url.searchParams);
		if (genreId) {
			params.set('genre', genreId.toString());
		} else {
			params.delete('genre');
		}
		params.set('page', '1');
		goto(`?${params.toString()}`);
	}

	function setSort(field: string) {
		const params = new URLSearchParams($page.url.searchParams);
		const currentSort = params.get('sort');
		const currentOrder = params.get('order') || 'desc';

		if (currentSort === field) {
			params.set('order', currentOrder === 'desc' ? 'asc' : 'desc');
		} else {
			params.set('sort', field);
			params.set('order', field === 'title' ? 'asc' : 'desc');
		}
		goto(`?${params.toString()}`);
	}

	// Handle column header sort click (for list view)
	type SortField = 'title' | 'series' | 'status' | 'format' | 'rating' | 'genre' | 'createdAt' | 'completedDate';
	function handleHeaderSort(field: SortField) {
		setSort(field);
	}

	async function addToLibrary(bookId: number) {
		addingBookId = bookId;
		try {
			const response = await fetch(`/api/books/${bookId}/library`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			if (response.ok) {
				toasts.success('Book added to your library!');
				await invalidateAll();
			} else {
				const errorData = await response.json();
				toasts.error(errorData.message || 'Failed to add book');
			}
		} catch (err) {
			toasts.error('Failed to add book to library');
		} finally {
			addingBookId = null;
		}
	}

	async function removeFromLibrary(bookId: number) {
		try {
			const response = await fetch(`/api/books/${bookId}/library`, {
				method: 'DELETE'
			});

			if (response.ok) {
				toasts.success('Book removed from your library');
				await invalidateAll();
			} else {
				const errorData = await response.json();
				toasts.error(errorData.message || 'Failed to remove book');
			}
		} catch (err) {
			toasts.error('Failed to remove book');
		}
	}

	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`?${params.toString()}`);
	}

	let totalPages = $derived(data.pagination.totalPages);
</script>

<svelte:head>
	<title>Library | BookShelf</title>
</svelte:head>

<div class="flex-1 overflow-y-auto">
	<div class="px-6 py-6">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
			<div class="flex items-center gap-3">
				<Library class="w-6 h-6" style="color: var(--accent);" />
				<div>
					<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Library</h1>
					<p class="text-sm" style="color: var(--text-muted);">
						{#if data.libraryStats}
							{data.libraryStats.personal.total} in your library
							{#if data.publicLibraryEnabled !== false && data.libraryStats.public.total > 0}
								&middot; {data.libraryStats.public.total} in public library
							{/if}
						{:else}
							Browse all books
						{/if}
					</p>
				</div>
			</div>

			<div class="flex items-center gap-2">
				{#if data.user && data.publicLibraryEnabled !== false}
					<button
						type="button"
						class="btn-accent flex items-center gap-2"
						onclick={() => (showUploadModal = true)}
					>
						<Upload class="w-4 h-4" />
						Upload Ebook
					</button>
				{/if}
			</div>
		</div>

		<!-- Stats Cards -->
		{#if data.libraryStats}
			<div class="card p-4 mb-6">
				<div class="flex flex-wrap gap-6 justify-center sm:justify-start">
					<div class="text-center">
						<div class="text-2xl font-bold" style="color: var(--text-primary);">{data.libraryStats.personal.total}</div>
						<div class="text-xs" style="color: var(--text-muted);">My Library</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold" style="color: var(--text-primary);">{data.libraryStats.personal.read}</div>
						<div class="text-xs" style="color: var(--text-muted);">Read</div>
					</div>
					<div class="text-center">
						<div class="text-2xl font-bold" style="color: var(--text-primary);">{data.libraryStats.personal.reading}</div>
						<div class="text-xs" style="color: var(--text-muted);">Reading</div>
					</div>
					{#if data.publicLibraryEnabled !== false}
						<div class="w-px self-stretch" style="background-color: var(--border-color);"></div>
						<div class="text-center">
							<div class="text-2xl font-bold" style="color: var(--accent);">{data.libraryStats.public.notInPersonal}</div>
							<div class="text-xs" style="color: var(--text-muted);">Available to Add</div>
						</div>
						<div class="text-center">
							<div class="text-2xl font-bold" style="color: var(--text-primary);">{data.libraryStats.all.total}</div>
							<div class="text-xs" style="color: var(--text-muted);">Total Tracked</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Tabs & Search -->
		<div class="card p-4 mb-6">
			<div class="flex flex-col sm:flex-row gap-4">
				<!-- Library Type Tabs -->
				<div class="flex items-center gap-1 rounded-lg p-1" style="background-color: var(--bg-tertiary);">
					{#each libraryTabs as tab}
						<button
							type="button"
							class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
							style="background-color: {data.filters.library === tab.value ? 'var(--bg-secondary)' : 'transparent'}; color: {data.filters.library === tab.value ? 'var(--text-primary)' : 'var(--text-muted)'};"
							onclick={() => setLibraryFilter(tab.value)}
						>
							<svelte:component this={tab.icon} class="w-4 h-4" />
							<span class="hidden sm:inline">{tab.label}</span>
						</button>
					{/each}
				</div>

				<!-- Search -->
				<form onsubmit={handleSearch} class="flex-1 relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style="color: var(--text-muted);" />
					<input
						type="text"
						placeholder="Search books..."
						class="input pl-10"
						bind:value={searchQuery}
					/>
				</form>

				<!-- View Toggle -->
				<div class="flex items-center gap-1 rounded-lg p-1" style="background-color: var(--bg-tertiary);">
					<button
						type="button"
						class="p-2 rounded transition-colors"
						style="background-color: {viewMode === 'grid' ? 'var(--bg-secondary)' : 'transparent'}; color: {viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)'};"
						onclick={() => (viewMode = 'grid')}
					>
						<Grid class="w-4 h-4" />
					</button>
					<button
						type="button"
						class="p-2 rounded transition-colors"
						style="background-color: {viewMode === 'list' ? 'var(--bg-secondary)' : 'transparent'}; color: {viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)'};"
						onclick={() => (viewMode = 'list')}
					>
						<List class="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>

		<!-- Genre Filters -->
		<div class="flex gap-2 flex-wrap mb-4">
			<button
				type="button"
				class="px-3 py-1 rounded-full text-xs font-medium transition-colors"
				style="background-color: {!data.filters.genre ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {!data.filters.genre ? 'white' : 'var(--text-secondary)'};"
				onclick={() => setGenreFilter(null)}
			>
				All Genres
			</button>
			{#each data.genres as genre}
				<button
					type="button"
					class="px-3 py-1 rounded-full text-xs font-medium transition-colors"
					style="background-color: {data.filters.genre === genre.id ? (genre.color || 'var(--accent)') : 'var(--bg-tertiary)'}; color: {data.filters.genre === genre.id ? 'white' : 'var(--text-secondary)'};"
					onclick={() => setGenreFilter(genre.id)}
				>
					{genre.name}
				</button>
			{/each}
		</div>

		<!-- Sort Controls -->
		<div class="flex items-center gap-2 mb-6">
			<span class="text-xs" style="color: var(--text-muted);">Sort by:</span>
			<button
				type="button"
				class="text-xs px-2 py-1 rounded transition-colors"
				style="color: {data.filters.sort === 'title' ? 'var(--accent)' : 'var(--text-muted)'}; font-weight: {data.filters.sort === 'title' ? '600' : '400'};"
				onclick={() => setSort('title')}
			>
				Title
			</button>
			<button
				type="button"
				class="text-xs px-2 py-1 rounded transition-colors"
				style="color: {data.filters.sort === 'createdAt' ? 'var(--accent)' : 'var(--text-muted)'}; font-weight: {data.filters.sort === 'createdAt' ? '600' : '400'};"
				onclick={() => setSort('createdAt')}
			>
				Date Added
			</button>
			<button
				type="button"
				class="text-xs px-2 py-1 rounded transition-colors"
				style="color: {data.filters.sort === 'rating' ? 'var(--accent)' : 'var(--text-muted)'}; font-weight: {data.filters.sort === 'rating' ? '600' : '400'};"
				onclick={() => setSort('rating')}
			>
				Rating
			</button>
		</div>

		<!-- Results Info -->
		<p class="text-sm mb-4" style="color: var(--text-secondary);">
			{data.pagination.total} {data.pagination.total === 1 ? 'book' : 'books'}
			{#if data.filters.search}
				matching "{data.filters.search}"
			{/if}
		</p>

		<!-- Books Grid/List -->
		{#if data.books.length === 0}
			<div class="text-center py-12">
				<Library class="w-16 h-16 mx-auto mb-4" style="color: var(--text-muted);" />
				<h3 class="text-lg font-medium mb-2" style="color: var(--text-primary);">No books found</h3>
				<p class="mb-4" style="color: var(--text-muted);">
					{#if data.filters.library === 'public'}
						The public library is empty. Upload some ebooks to get started!
					{:else if data.filters.library === 'personal'}
						You haven't added any books to your library yet.
					{:else}
						No books match your search criteria.
					{/if}
				</p>
				{#if data.user && data.filters.library === 'public' && data.publicLibraryEnabled !== false}
					<button
						type="button"
						class="btn-accent inline-flex items-center gap-2"
						onclick={() => (showUploadModal = true)}
					>
						<Upload class="w-4 h-4" />
						Upload Ebook
					</button>
				{/if}
			</div>
		{:else if viewMode === 'grid'}
			<BookGrid gap="md">
				{#each data.books as book}
					<div class="relative group">
						<BookCard
							book={toBookCardData(book)}
							onClick={() => goto(`/books/${book.id}`)}
						/>

						<!-- Library Action Overlay -->
						<div class="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity" style="background: linear-gradient(transparent, rgba(0,0,0,0.85));">
							{#if book.inUserLibrary}
								<button
									type="button"
									class="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
									style="background-color: #22c55e;"
									onclick={(e) => { e.stopPropagation(); removeFromLibrary(book.id); }}
								>
									<Check class="w-4 h-4" />
									In Library
								</button>
							{:else}
								<button
									type="button"
									class="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
									style="background-color: var(--accent);"
									disabled={addingBookId === book.id}
									onclick={(e) => { e.stopPropagation(); addToLibrary(book.id); }}
								>
									<Plus class="w-4 h-4" />
									Add to Library
								</button>
							{/if}
						</div>

						<!-- Library Type Badge -->
						{#if book.libraryType === 'public'}
							<span class="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium text-white" style="background-color: rgba(59, 130, 246, 0.9);">
								Public
							</span>
						{/if}
					</div>
				{/each}
			</BookGrid>
		{:else}
			<!-- List View -->
			<div class="card overflow-hidden">
				<BookListHeader
					showSeries={false}
					showStatus={false}
					showTags={false}
					sortField={data.filters.sort as SortField}
					sortOrder={data.filters.order as 'asc' | 'desc'}
					onSort={handleHeaderSort}
				/>
				<div class="divide-y" style="border-color: var(--border-color);">
					{#each data.books as book}
						<div class="relative">
							<BookRow
								book={toBookCardData(book)}
								showSeries={false}
								showStatus={false}
								showTags={false}
								onClick={handleRowClick}
							/>
							<!-- Library action buttons for list view -->
							<div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
								{#if book.libraryType === 'public'}
									<span class="px-2 py-0.5 rounded text-[10px] font-medium text-white" style="background-color: rgba(59, 130, 246, 0.9);">
										Public
									</span>
								{/if}
								{#if book.inUserLibrary}
									<button
										type="button"
										class="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white transition-colors"
										style="background-color: #22c55e;"
										onclick={(e) => { e.stopPropagation(); removeFromLibrary(book.id); }}
									>
										<Check class="w-3 h-3" />
										In Library
									</button>
								{:else}
									<button
										type="button"
										class="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white transition-colors"
										style="background-color: var(--accent);"
										disabled={addingBookId === book.id}
										onclick={(e) => { e.stopPropagation(); addToLibrary(book.id); }}
									>
										<Plus class="w-3 h-3" />
										Add
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2 mt-8 mb-16">
				<button
					type="button"
					class="btn-ghost p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={data.pagination.page <= 1}
					onclick={() => goToPage(data.pagination.page - 1)}
				>
					<ChevronLeft class="w-5 h-5" />
				</button>

				<span class="px-4 py-2 text-sm" style="color: var(--text-secondary);">
					Page {data.pagination.page} of {totalPages}
				</span>

				<button
					type="button"
					class="btn-ghost p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={data.pagination.page >= totalPages}
					onclick={() => goToPage(data.pagination.page + 1)}
				>
					<ChevronRight class="w-5 h-5" />
				</button>
			</div>
		{/if}
	</div>
</div>

<!-- Upload Modal -->
<Modal open={showUploadModal} title="Upload Ebook" size="lg" onClose={closeUploadModal}>
	<EbookUpload
		libraryType="public"
		onComplete={handleUploadComplete}
		onClose={closeUploadModal}
	/>
</Modal>
