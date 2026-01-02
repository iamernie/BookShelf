<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { BookOpen, Plus, Grid, List, Search, ChevronLeft, ChevronRight, SlidersHorizontal, SquareCheck, Library } from 'lucide-svelte';
	import BookCard from '$lib/components/book/BookCard.svelte';
	import BookGrid from '$lib/components/book/BookGrid.svelte';
	import BookRow from '$lib/components/book/BookRow.svelte';
	import BookListHeader from '$lib/components/book/BookListHeader.svelte';
	import BookModal from '$lib/components/book/BookModal.svelte';
	import BookFilters from '$lib/components/book/BookFilters.svelte';
	import BulkActionBar from '$lib/components/bulk/BulkActionBar.svelte';
	import BulkTagModal from '$lib/components/bulk/BulkTagModal.svelte';
	import BulkStatusModal from '$lib/components/bulk/BulkStatusModal.svelte';
	import BulkDeleteModal from '$lib/components/bulk/BulkDeleteModal.svelte';
	import { toasts } from '$lib/stores/toast';
	import { selectedBooks, hasSelection, selectedIds } from '$lib/stores/selection';
	import type { BookWithRelations } from '$lib/server/services/bookService';
	import type { BookCardData } from '$lib/types';

	// Convert BookWithRelations to BookCardData for row/card components
	function toBookCardData(book: BookWithRelations): BookCardData {
		return {
			id: book.id,
			title: book.title,
			coverImageUrl: book.coverImageUrl,
			rating: book.rating,
			authorName: book.authors[0]?.name || null,
			seriesName: book.series[0]?.title || null,
			bookNum: book.series[0]?.bookNum || null,
			ebookPath: book.ebookPath,
			audiobookId: book.audiobookId,
			status: book.status,
			genre: book.genre,
			format: book.format,
			tags: book.tags
		};
	}

	let { data } = $props();

	let viewMode = $state<'grid' | 'list' | 'series'>('grid');
	let searchInput = $state('');
	let showAddModal = $state(false);
	let showFilters = $state(false);
	let selectMode = $state(false);
	let showTagModal = $state(false);
	let showStatusModal = $state(false);
	let showDeleteModal = $state(false);

	// Check for special URL params (audiobook-only flow)
	let audiobookOnly = $derived($page.url.searchParams.get('audiobookOnly') === 'true');
	let isPublicLibrary = $derived($page.url.searchParams.get('public') === 'true');
	let addAudio = $derived($page.url.searchParams.get('addAudio') === 'true');

	// Auto-show add modal if audiobookOnly or addAudio param is present
	$effect(() => {
		if (audiobookOnly || addAudio) {
			showAddModal = true;
		}
	});

	// Sync searchInput with URL parameter
	$effect(() => {
		searchInput = data.search;
	});

	// Clear selection when navigating away or when data changes
	$effect(() => {
		// Track page changes to clear selection
		const currentPage = data.page;
		return () => {
			selectedBooks.clear();
		};
	});

	let totalPages = $derived(Math.ceil(data.total / data.limit));

	let hasActiveFilters = $derived(
		data.statusId !== undefined ||
		data.genreId !== undefined ||
		data.formatId !== undefined ||
		data.tagId !== undefined ||
		data.authorId !== undefined ||
		data.seriesId !== undefined
	);

	let activeFilterCount = $derived(
		[data.statusId, data.genreId, data.formatId, data.tagId, data.authorId, data.seriesId]
			.filter(f => f !== undefined).length
	);

	// Book IDs on current page for select all
	let currentPageBookIds = $derived(data.items.map(b => b.id));

	// Selected book titles for delete modal
	let selectedBookTitles = $derived(
		data.items
			.filter(b => $selectedIds.includes(b.id))
			.map(b => b.title)
	);

	// Group books by series for series view
	interface SeriesGroup {
		id: number | null;
		title: string;
		books: BookWithRelations[];
	}

	let booksBySeries = $derived(() => {
		const groups: SeriesGroup[] = [];
		const seriesMap = new Map<number, SeriesGroup>();
		const standalone: BookWithRelations[] = [];

		for (const book of data.items) {
			const primarySeries = book.series[0];
			if (primarySeries) {
				if (!seriesMap.has(primarySeries.id)) {
					seriesMap.set(primarySeries.id, {
						id: primarySeries.id,
						title: primarySeries.title,
						books: []
					});
				}
				seriesMap.get(primarySeries.id)!.books.push(book);
			} else {
				standalone.push(book);
			}
		}

		// Sort series by name and add to groups
		const sortedSeries = Array.from(seriesMap.values()).sort((a, b) =>
			a.title.localeCompare(b.title)
		);

		// Sort books within each series by bookNum
		for (const group of sortedSeries) {
			group.books.sort((a, b) => {
				const numA = a.series[0]?.bookNum ?? 999;
				const numB = b.series[0]?.bookNum ?? 999;
				return numA - numB;
			});
		}

		groups.push(...sortedSeries);

		// Add standalone books at the end
		if (standalone.length > 0) {
			groups.push({
				id: null,
				title: 'Standalone Books',
				books: standalone
			});
		}

		return groups;
	});

	function handleSearch() {
		const params = new URLSearchParams($page.url.searchParams);
		if (searchInput) {
			params.set('search', searchInput);
		} else {
			params.delete('search');
		}
		params.delete('page');
		goto(`/books?${params.toString()}`);
	}

	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`/books?${params.toString()}`);
	}

	function openBook(bookItem: { id: number }) {
		// Don't navigate if in select mode
		if (selectMode) {
			selectedBooks.toggle(bookItem.id);
			return;
		}
		goto(`/books/${bookItem.id}`);
	}

	function handleRowClick(book: BookCardData) {
		if (selectMode) {
			selectedBooks.toggle(book.id);
			return;
		}
		goto(`/books/${book.id}`);
	}

	// Check if all books on current page are selected
	let allSelected = $derived(
		currentPageBookIds.length > 0 &&
		currentPageBookIds.every((id) => $selectedBooks.has(id))
	);

	function toggleSelectMode() {
		selectMode = !selectMode;
		if (!selectMode) {
			selectedBooks.clear();
		}
	}

	function handleSelectAll() {
		selectedBooks.selectAll(currentPageBookIds);
	}

	function handleClearSelection() {
		selectedBooks.clear();
		selectMode = false;
	}

	// Map header column names to backend sort fields
	type SortField = 'title' | 'series' | 'status' | 'format' | 'rating' | 'genre' | 'createdAt' | 'completedDate';

	function handleSort(field: SortField) {
		const params = new URLSearchParams($page.url.searchParams);
		const currentSort = data.sort;
		const currentOrder = data.order;

		// If clicking the same field, toggle the order; otherwise, set new field with default order
		if (currentSort === field) {
			params.set('order', currentOrder === 'asc' ? 'desc' : 'asc');
		} else {
			params.set('sort', field);
			// Default to desc for rating, asc for title, desc for others
			params.set('order', field === 'title' ? 'asc' : 'desc');
		}
		params.delete('page'); // Reset to first page
		goto(`/books?${params.toString()}`);
	}

	function handleBulkComplete() {
		selectedBooks.clear();
		selectMode = false;
		showTagModal = false;
		showStatusModal = false;
		showDeleteModal = false;
		invalidateAll();
	}

	async function handleAddBook(bookData: any) {
		// Include libraryType if creating for public library
		const dataToSend = {
			...bookData,
			...(isPublicLibrary ? { libraryType: 'public' } : {})
		};

		const res = await fetch('/api/books', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(dataToSend)
		});
		if (res.ok) {
			const newBook = await res.json();
			showAddModal = false;

			// If audiobookOnly or addAudio, redirect to edit page Media tab
			if (audiobookOnly || addAudio) {
				toasts.success('Book created. Now add audio files.');
				goto(`/books/${newBook.id}/edit?tab=media`);
			} else {
				toasts.success('Book created');
				invalidateAll();
			}
		} else {
			const err = await res.json();
			toasts.error(err.message || 'Failed to create book');
			throw new Error(err.message);
		}
	}

	async function handleQuickEdit(bookId: number, field: string, value: any) {
		const res = await fetch(`/api/books/${bookId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ [field]: value })
		});
		if (res.ok) {
			toasts.success(`Updated ${field === 'statusId' ? 'status' : field}`);
			invalidateAll();
		} else {
			const err = await res.json();
			toasts.error(err.message || `Failed to update ${field}`);
		}
	}
</script>

<svelte:head>
	<title>Books - BookShelf</title>
</svelte:head>

<div class="flex h-full">
	<!-- Filters Sidebar -->
	{#if showFilters}
		<BookFilters
			statuses={data.options.statuses}
			genres={data.options.genres}
			formats={data.options.formats}
			tags={data.options.tags}
			authors={data.options.authors}
			series={data.options.series.map(s => ({ id: s.id, name: s.title }))}
			selectedStatus={data.statusId}
			selectedGenre={data.genreId}
			selectedFormat={data.formatId}
			selectedTag={data.tagId}
			selectedAuthor={data.authorId}
			selectedSeries={data.seriesId}
			filterMode={data.filterMode}
		/>
	{/if}

	<!-- Main Content -->
	<div class="flex-1 overflow-y-auto">
		<div class="px-6 py-6">
			<!-- Header -->
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
				<div class="flex items-center gap-3">
					<button
						type="button"
						class="p-2 rounded-lg transition-colors relative"
						style="background-color: {showFilters ? 'var(--bg-hover)' : 'transparent'}; color: var(--text-secondary);"
						onclick={() => showFilters = !showFilters}
						title={showFilters ? 'Hide filters' : 'Show filters'}
					>
						<SlidersHorizontal class="w-5 h-5" />
						{#if activeFilterCount > 0 && !showFilters}
							<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-medium flex items-center justify-center text-white" style="background-color: var(--accent);">
								{activeFilterCount}
							</span>
						{/if}
					</button>
					<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Books</h1>
				</div>

				<div class="flex items-center gap-2">
					<!-- Select Mode Toggle -->
					<button
						type="button"
						class="btn-ghost flex items-center gap-2 px-3 py-2"
						style="background-color: {selectMode ? 'var(--bg-hover)' : 'transparent'};"
						onclick={toggleSelectMode}
						title={selectMode ? 'Exit select mode' : 'Enter select mode'}
					>
						<SquareCheck class="w-4 h-4" />
						<span class="hidden sm:inline">{selectMode ? 'Cancel' : 'Select'}</span>
					</button>

					<a
						href="/library/add"
						class="btn-accent flex items-center gap-2"
					>
						<Plus class="w-4 h-4" />
						Add Book
					</a>
				</div>
			</div>

			<!-- Search & View Toggle Bar -->
			<div class="card p-4 mb-6">
				<div class="flex flex-col sm:flex-row gap-4">
					<!-- Search -->
					<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="flex-1 relative">
						<button
							type="submit"
							class="absolute left-3 top-1/2 -translate-y-1/2 p-0 bg-transparent border-none cursor-pointer hover:opacity-80"
							title="Search"
						>
							<Search class="w-5 h-5" style="color: var(--text-muted);" />
						</button>
						<input
							type="text"
							placeholder="Search books..."
							class="input pl-10"
							bind:value={searchInput}
						/>
					</form>

					<!-- Sort -->
					<select
						class="select"
						value={`${data.sort}-${data.order}`}
						onchange={(e) => {
							const [sort, order] = e.currentTarget.value.split('-');
							const params = new URLSearchParams($page.url.searchParams);
							params.set('sort', sort);
							params.set('order', order);
							params.delete('page');
							goto(`/books?${params.toString()}`);
						}}
					>
						<option value="createdAt-desc">Recently Added</option>
						<option value="createdAt-asc">Oldest Added</option>
						<option value="title-asc">Title A-Z</option>
						<option value="title-desc">Title Z-A</option>
						<option value="rating-desc">Highest Rated</option>
						<option value="rating-asc">Lowest Rated</option>
						<option value="completedDate-desc">Recently Completed</option>
					</select>

					<!-- View Toggle -->
					<div class="flex items-center gap-1 rounded-lg p-1" style="background-color: var(--bg-tertiary);">
						<button
							type="button"
							class="p-2 rounded transition-colors"
							style="background-color: {viewMode === 'grid' ? 'var(--bg-secondary)' : 'transparent'}; color: {viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)'};"
							onclick={() => viewMode = 'grid'}
							title="Grid view"
						>
							<Grid class="w-4 h-4" />
						</button>
						<button
							type="button"
							class="p-2 rounded transition-colors"
							style="background-color: {viewMode === 'series' ? 'var(--bg-secondary)' : 'transparent'}; color: {viewMode === 'series' ? 'var(--text-primary)' : 'var(--text-muted)'};"
							onclick={() => viewMode = 'series'}
							title="Series view"
						>
							<Library class="w-4 h-4" />
						</button>
						<button
							type="button"
							class="p-2 rounded transition-colors"
							style="background-color: {viewMode === 'list' ? 'var(--bg-secondary)' : 'transparent'}; color: {viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)'};"
							onclick={() => viewMode = 'list'}
							title="List view"
						>
							<List class="w-4 h-4" />
						</button>
					</div>
				</div>
			</div>

			<!-- Results info -->
			<p class="text-sm mb-4" style="color: var(--text-secondary);">
				{data.total} {data.total === 1 ? 'book' : 'books'}
				{#if data.search}
					matching "{data.search}"
				{/if}
			</p>

			<!-- Books Grid/List/Series -->
			{#if data.items.length > 0}
				{#if viewMode === 'grid'}
					<BookGrid gap="md">
						{#each data.items as book (book.id)}
							<BookCard
								book={toBookCardData(book)}
								selectable={selectMode}
								selected={$selectedBooks.has(book.id)}
								quickEdit={!selectMode}
								statuses={data.options.statuses}
								onSelect={(id) => selectedBooks.toggle(id)}
								onClick={() => openBook(book)}
								onQuickEdit={handleQuickEdit}
							/>
						{/each}
					</BookGrid>
				{:else if viewMode === 'series'}
					<!-- Series View -->
					<div class="space-y-8">
						{#each booksBySeries() as group (group.id ?? 'standalone')}
							<div>
								<!-- Series Header -->
								<div class="flex items-center gap-3 mb-4">
									{#if group.id}
										<a
											href="/series/{group.id}"
											class="text-lg font-semibold hover:underline"
											style="color: var(--text-primary);"
										>
											{group.title}
										</a>
									{:else}
										<span class="text-lg font-semibold" style="color: var(--text-muted);">
											{group.title}
										</span>
									{/if}
									<span class="text-sm px-2 py-0.5 rounded-full" style="background-color: var(--bg-tertiary); color: var(--text-muted);">
										{group.books.length} {group.books.length === 1 ? 'book' : 'books'}
									</span>
								</div>
								<!-- Series Books Grid -->
								<BookGrid gap="md">
									{#each group.books as book (book.id)}
										<BookCard
											book={toBookCardData(book)}
											selectable={selectMode}
											selected={$selectedBooks.has(book.id)}
											quickEdit={!selectMode}
											statuses={data.options.statuses}
											onSelect={(id) => selectedBooks.toggle(id)}
											onClick={() => openBook(book)}
											onQuickEdit={handleQuickEdit}
										/>
									{/each}
								</BookGrid>
							</div>
						{/each}
					</div>
				{:else}
					<!-- List View -->
					<div class="card overflow-hidden">
						<BookListHeader
							selectable={selectMode}
							{allSelected}
							onSelectAll={handleSelectAll}
							sortField={data.sort}
							sortOrder={data.order}
							onSort={handleSort}
						/>
						<div class="divide-y" style="border-color: var(--border-color);">
							{#each data.items as book (book.id)}
								<BookRow
									book={toBookCardData(book)}
									selectable={selectMode}
									selected={$selectedBooks.has(book.id)}
									onSelect={(id) => selectedBooks.toggle(id)}
									onClick={handleRowClick}
								/>
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
							disabled={data.page <= 1}
							onclick={() => goToPage(data.page - 1)}
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
						>
							<ChevronRight class="w-5 h-5" />
						</button>
					</div>
				{/if}
			{:else}
				<div class="text-center py-12">
					<BookOpen class="w-16 h-16 mx-auto mb-4" style="color: var(--text-muted);" />
					<h3 class="text-lg font-medium mb-2" style="color: var(--text-primary);">No books found</h3>
					<p class="mb-4" style="color: var(--text-muted);">
						{data.search ? 'Try a different search term' : 'Get started by adding your first book'}
					</p>
					{#if !data.search}
						<a
							href="/library/add"
							class="btn-accent inline-flex items-center gap-2"
						>
							<Plus class="w-4 h-4" />
							Add Book
						</a>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Bulk Action Bar -->
<BulkActionBar
	totalCount={currentPageBookIds.length}
	onAddTags={() => showTagModal = true}
	onChangeStatus={() => showStatusModal = true}
	onDelete={() => showDeleteModal = true}
	onSelectAll={handleSelectAll}
	onClearSelection={handleClearSelection}
	onComplete={handleBulkComplete}
	authors={data.options.authors}
	narrators={data.options.narrators}
	series={data.options.series}
	formats={data.options.formats}
	genres={data.options.genres}
/>

<!-- Add Book Modal -->
{#if showAddModal}
	<BookModal
		book={null}
		options={data.options}
		mode="add"
		onClose={() => showAddModal = false}
		onSave={handleAddBook}
	/>
{/if}

<!-- Bulk Tag Modal -->
{#if showTagModal}
	<BulkTagModal
		bookIds={$selectedIds}
		tags={data.options.tags}
		onClose={() => showTagModal = false}
		onComplete={handleBulkComplete}
	/>
{/if}

<!-- Bulk Status Modal -->
{#if showStatusModal}
	<BulkStatusModal
		bookIds={$selectedIds}
		statuses={data.options.statuses}
		onClose={() => showStatusModal = false}
		onComplete={handleBulkComplete}
	/>
{/if}

<!-- Bulk Delete Modal -->
{#if showDeleteModal}
	<BulkDeleteModal
		bookIds={$selectedIds}
		bookTitles={selectedBookTitles}
		onClose={() => showDeleteModal = false}
		onComplete={handleBulkComplete}
	/>
{/if}
