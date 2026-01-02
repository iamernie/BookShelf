<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Library,
		BookOpen,
		Edit2,
		Trash2,
		Star,
		AlertTriangle,
		ArrowLeft,
		Plus,
		User,
		Check,
		X,
		Pencil,
		Tags,
		Grid,
		List,
		SquareCheck
	} from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import BookCard from '$lib/components/book/BookCard.svelte';
	import BookRow from '$lib/components/book/BookRow.svelte';
	import BookListHeader from '$lib/components/book/BookListHeader.svelte';
	import BulkActionBar from '$lib/components/bulk/BulkActionBar.svelte';
	import BulkTagModal from '$lib/components/bulk/BulkTagModal.svelte';
	import BulkStatusModal from '$lib/components/bulk/BulkStatusModal.svelte';
	import BulkDeleteModal from '$lib/components/bulk/BulkDeleteModal.svelte';
	import { toasts } from '$lib/stores/toast';
	import { selectedBooks, selectedIds } from '$lib/stores/selection';

	let { data } = $props();

	let deleting = $state(false);

	// View mode and selection state
	let viewMode = $state<'grid' | 'list'>('grid');
	let selectMode = $state(false);
	let showBulkTagModal = $state(false);
	let showBulkStatusModal = $state(false);
	let showBulkDeleteModal = $state(false);

	// Book IDs for selection
	let bookIds = $derived(data.books.map(b => b.id));

	// Selected book titles for delete modal
	let selectedBookTitles = $derived(
		data.books
			.filter(b => $selectedIds.includes(b.id))
			.map(b => b.title)
	);

	// Clear selection when leaving page
	$effect(() => {
		return () => {
			selectedBooks.clear();
		};
	});

	function toggleSelectMode() {
		selectMode = !selectMode;
		if (!selectMode) {
			selectedBooks.clear();
		}
	}

	function handleSelectAll() {
		const allSelected = bookIds.every(id => $selectedIds.includes(id));
		if (allSelected) {
			selectedBooks.clear();
		} else {
			selectedBooks.selectAll(bookIds);
		}
	}

	function openBook(book: { id: number }) {
		if (selectMode) {
			selectedBooks.toggle(book.id);
			return;
		}
		goto(`/books/${book.id}`);
	}

	// Inline editing state
	let editingDescription = $state(false);
	let editingNotes = $state(false);
	let savingDescription = $state(false);
	let savingNotes = $state(false);

	// Derived values that update when data changes
	let descriptionValue = $derived(data.series.description || '');
	let notesValue = $derived(data.series.comments || '');

	// Local editable copies
	let editDescriptionValue = $state('');
	let editNotesValue = $state('');

	// Initialize edit values when editing starts
	function startEditDescription() {
		editDescriptionValue = data.series.description || '';
		editingDescription = true;
	}

	function startEditNotes() {
		editNotesValue = data.series.comments || '';
		editingNotes = true;
	}

	// Tag management state
	let showTagPicker = $state(false);
	let savingTag = $state(false);

	// Reactive current tags from data
	let currentTagIds = $derived(new Set(data.tags.map((t: { id: number }) => t.id)));

	async function saveDescription() {
		savingDescription = true;
		try {
			const res = await fetch(`/api/series/${data.series.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: editDescriptionValue })
			});
			if (res.ok) {
				toasts.success('Description saved');
				editingDescription = false;
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save description');
			}
		} finally {
			savingDescription = false;
		}
	}

	async function saveNotes() {
		savingNotes = true;
		try {
			const res = await fetch(`/api/series/${data.series.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ comments: editNotesValue })
			});
			if (res.ok) {
				toasts.success('Notes saved');
				editingNotes = false;
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save notes');
			}
		} finally {
			savingNotes = false;
		}
	}

	function cancelDescriptionEdit() {
		editingDescription = false;
	}

	function cancelNotesEdit() {
		editingNotes = false;
	}

	async function toggleTag(tagId: number) {
		savingTag = true;
		const hasTag = currentTagIds.has(tagId);

		try {
			const res = await fetch(`/api/series/${data.series.id}/tags`, {
				method: hasTag ? 'DELETE' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tagId })
			});

			if (res.ok) {
				toasts.success(hasTag ? 'Tag removed' : 'Tag added');
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to update tag');
			}
		} finally {
			savingTag = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this series? This will not delete the books.')) {
			return;
		}
		deleting = true;
		try {
			const res = await fetch(`/api/series/${data.series.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				toasts.success('Series deleted');
				goto('/series');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to delete series');
			}
		} finally {
			deleting = false;
		}
	}

</script>

<svelte:head>
	<title>{data.series.title} - BookShelf</title>
</svelte:head>

<div class="page-container">
	<!-- Back navigation -->
	<button type="button" onclick={() => history.back()} class="back-link">
		<ArrowLeft class="w-4 h-4" />
		Back
	</button>

	<!-- Header section -->
	<div class="series-header">
		<div class="header-left">
			<div class="series-icon">
				<Library class="w-12 h-12" style="color: var(--accent);" />
			</div>
			<div class="header-info">
				<h1 class="series-title">{data.series.title}</h1>
				<div class="series-meta">
					{#if data.stats.totalBooks > 0}
						<span class="meta-item">
							<BookOpen class="w-4 h-4" />
							{data.stats.totalBooks} books
						</span>
					{/if}
					{#if data.series.numBooks && data.series.numBooks !== data.stats.totalBooks}
						<span class="meta-item muted">
							({data.series.numBooks} in complete series)
						</span>
					{/if}
				</div>
			</div>
		</div>
		<div class="header-actions">
			<a href="/series/{data.series.id}/edit" class="btn-secondary">
				<Edit2 class="w-4 h-4" />
				Edit
			</a>
			<button
				type="button"
				class="btn-danger"
				onclick={handleDelete}
				disabled={deleting}
			>
				<Trash2 class="w-4 h-4" />
				Delete
			</button>
		</div>
	</div>

	<!-- Compact Stats Bar -->
	<div class="stats-bar">
		<!-- Progress with inline stats -->
		<div class="progress-row">
			<div class="progress-stats">
				<span class="stat-inline">
					<strong>{data.stats.readBooks}</strong>/<strong>{data.stats.totalBooks}</strong> read
				</span>
				{#if data.stats.averageRating}
					<span class="stat-inline rating">
						<Star class="w-3.5 h-3.5" style="fill: #f59e0b; color: #f59e0b;" />
						{data.stats.averageRating}
					</span>
				{/if}
				{#if data.stats.totalPages > 0}
					<span class="stat-inline muted">{data.stats.totalPages.toLocaleString()} pages</span>
				{/if}
			</div>
			<span class="progress-percent {data.stats.completionPercentage === 100 ? 'complete' : ''}">
				{data.stats.completionPercentage}%
			</span>
		</div>
		<div class="progress-bar">
			<div
				class="progress-fill {data.stats.completionPercentage === 100 ? 'complete' : ''}"
				style="width: {data.stats.completionPercentage}%"
			></div>
		</div>

		<!-- Reading status & warnings inline -->
		<div class="status-row">
			{#if data.stats.nextBook}
				<span class="status-inline highlight">
					<strong>Next:</strong> {data.stats.nextBook}
				</span>
			{:else if data.stats.unreadBooks === 0}
				<span class="status-inline complete">
					<i class="fas fa-check-circle"></i> Complete!
				</span>
			{/if}
			{#if data.stats.lastReadBook}
				<span class="status-inline muted">Last: {data.stats.lastReadBook}</span>
			{/if}
			{#if data.stats.gapAnalysis.hasGaps}
				<span class="status-inline warning" title="Missing: Books #{data.stats.gapAnalysis.missingBooks.join(', #')}">
					<AlertTriangle class="w-3 h-3" />
					{data.stats.gapAnalysis.missingBooks.length} missing
				</span>
			{/if}
		</div>
	</div>

	<!-- Description, Notes & Tags in a compact grid -->
	<div class="details-grid">
		<!-- Description -->
		<div class="detail-card">
			<div class="detail-header">
				<h3 class="detail-title">Description</h3>
				{#if !editingDescription}
					<button type="button" class="edit-icon-btn" onclick={startEditDescription} title="Edit">
						<Pencil class="w-3 h-3" />
					</button>
				{/if}
			</div>
			{#if editingDescription}
				<div class="inline-edit">
					<textarea
						class="edit-textarea"
						bind:value={editDescriptionValue}
						placeholder="Add a description..."
						rows="3"
					></textarea>
					<div class="edit-actions">
						<button type="button" class="btn-save-sm" onclick={saveDescription} disabled={savingDescription}>
							<Check class="w-3 h-3" />
							{savingDescription ? 'Saving...' : 'Save'}
						</button>
						<button type="button" class="btn-cancel-sm" onclick={cancelDescriptionEdit} disabled={savingDescription}>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<button type="button" class="detail-content-btn" onclick={startEditDescription}>
					{#if data.series.description}
						<span class="detail-text">{data.series.description}</span>
					{:else}
						<span class="detail-placeholder">Click to add...</span>
					{/if}
				</button>
			{/if}
		</div>

		<!-- Notes -->
		<div class="detail-card">
			<div class="detail-header">
				<h3 class="detail-title">Notes</h3>
				{#if !editingNotes}
					<button type="button" class="edit-icon-btn" onclick={startEditNotes} title="Edit">
						<Pencil class="w-3 h-3" />
					</button>
				{/if}
			</div>
			{#if editingNotes}
				<div class="inline-edit">
					<textarea
						class="edit-textarea"
						bind:value={editNotesValue}
						placeholder="Add notes..."
						rows="3"
					></textarea>
					<div class="edit-actions">
						<button type="button" class="btn-save-sm" onclick={saveNotes} disabled={savingNotes}>
							<Check class="w-3 h-3" />
							{savingNotes ? 'Saving...' : 'Save'}
						</button>
						<button type="button" class="btn-cancel-sm" onclick={cancelNotesEdit} disabled={savingNotes}>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<button type="button" class="detail-content-btn" onclick={startEditNotes}>
					{#if data.series.comments}
						<span class="detail-text">{data.series.comments}</span>
					{:else}
						<span class="detail-placeholder">Click to add...</span>
					{/if}
				</button>
			{/if}
		</div>

		<!-- Tags -->
		<div class="detail-card">
			<div class="detail-header">
				<h3 class="detail-title">Tags</h3>
				<button
					type="button"
					class="edit-icon-btn"
					class:active={showTagPicker}
					onclick={() => (showTagPicker = !showTagPicker)}
					title={showTagPicker ? 'Close' : 'Edit tags'}
				>
					<Plus class="w-3 h-3" style="transform: rotate({showTagPicker ? 45 : 0}deg); transition: transform 0.2s;" />
				</button>
			</div>
			<div class="tags-display">
				{#if data.tags.length > 0}
					{#each data.tags as tag (tag.id)}
						<span class="tag-badge-sm" style="background-color: {tag.color || '#6c757d'};">
							{#if tag.icon}<DynamicIcon icon={tag.icon} size={10} />{/if}
							{tag.name}
						</span>
					{/each}
				{:else}
					<span class="no-tags">No tags</span>
				{/if}
			</div>
			{#if showTagPicker}
				<div class="tag-picker-compact">
					{#if data.allTags.length > 0}
						{#each data.allTags as tag (tag.id)}
							<button
								type="button"
								class="tag-picker-item-sm"
								class:selected={currentTagIds.has(tag.id)}
								style="background-color: {tag.color || '#6c757d'};"
								onclick={() => toggleTag(tag.id)}
								disabled={savingTag}
							>
								{#if tag.icon}<DynamicIcon icon={tag.icon} size={10} />{/if}
								{tag.name}
								{#if currentTagIds.has(tag.id)}<Check class="w-3 h-3" />{/if}
							</button>
						{/each}
					{:else}
						<span class="no-tags"><a href="/tags">Create tags</a></span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Books Section -->
	<div class="books-section">
		<div class="books-header">
			<h2 class="section-title">
				<BookOpen class="w-5 h-5" />
				Books in Series ({data.books.length})
			</h2>
			<div class="header-controls">
				<!-- Select Mode Toggle -->
				{#if data.books.length > 0}
					<button
						type="button"
						class="control-btn"
						class:active={selectMode}
						onclick={toggleSelectMode}
						title={selectMode ? 'Exit select mode' : 'Select books'}
					>
						<SquareCheck class="w-4 h-4" />
					</button>

					<!-- View Mode Toggle -->
					<div class="view-toggle">
						<button
							type="button"
							class="toggle-btn"
							class:active={viewMode === 'grid'}
							onclick={() => viewMode = 'grid'}
							title="Grid view"
						>
							<Grid class="w-4 h-4" />
						</button>
						<button
							type="button"
							class="toggle-btn"
							class:active={viewMode === 'list'}
							onclick={() => viewMode = 'list'}
							title="List view"
						>
							<List class="w-4 h-4" />
						</button>
					</div>
				{/if}

				<a href="/books?add=true&seriesId={data.series.id}" class="btn-primary">
					<Plus class="w-4 h-4" />
					Add Book
				</a>
			</div>
		</div>

		{#if data.books.length > 0}
			{#if viewMode === 'grid'}
				<div class="books-grid">
					{#each data.books as book (book.id)}
						<BookCard
							{book}
							showSeries={false}
							selectable={selectMode}
							selected={$selectedBooks.has(book.id)}
							onSelect={(id) => selectedBooks.toggle(id)}
							onClick={() => openBook(book)}
						/>
					{/each}
				</div>
			{:else}
				<div class="books-list">
					<BookListHeader
						selectable={selectMode}
						showSeries={false}
						allSelected={bookIds.every(id => $selectedIds.includes(id))}
						onSelectAll={handleSelectAll}
					/>
					{#each data.books as book (book.id)}
						<BookRow
							{book}
							showSeries={false}
							selectable={selectMode}
							selected={$selectedBooks.has(book.id)}
							onSelect={(id) => selectedBooks.toggle(id)}
							onClick={() => openBook(book)}
						/>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="empty-state">
				<BookOpen class="w-12 h-12" />
				<p>No books in this series yet</p>
				<a href="/books?add=true&seriesId={data.series.id}" class="btn-primary">
					Add First Book
				</a>
			</div>
		{/if}
	</div>
</div>

<!-- Bulk Action Bar -->
<BulkActionBar
	totalCount={data.books.length}
	onSelectAll={handleSelectAll}
	onClearSelection={() => selectedBooks.clear()}
	onAddTags={() => showBulkTagModal = true}
	onChangeStatus={() => showBulkStatusModal = true}
	onDelete={() => showBulkDeleteModal = true}
	onComplete={() => invalidateAll()}
	authors={data.options.authors}
	narrators={data.options.narrators}
	series={data.options.series}
	formats={data.options.formats}
	genres={data.options.genres}
/>

<!-- Bulk Modals -->
{#if showBulkTagModal}
	<BulkTagModal
		bookIds={$selectedIds}
		tags={data.options.tags}
		onClose={() => showBulkTagModal = false}
		onComplete={() => {
			showBulkTagModal = false;
			invalidateAll();
		}}
	/>
{/if}

{#if showBulkStatusModal}
	<BulkStatusModal
		bookIds={$selectedIds}
		statuses={data.options.statuses}
		onClose={() => showBulkStatusModal = false}
		onComplete={() => {
			showBulkStatusModal = false;
			invalidateAll();
		}}
	/>
{/if}

{#if showBulkDeleteModal}
	<BulkDeleteModal
		bookIds={$selectedIds}
		bookTitles={selectedBookTitles}
		onClose={() => showBulkDeleteModal = false}
		onComplete={() => {
			showBulkDeleteModal = false;
			selectedBooks.clear();
			invalidateAll();
		}}
	/>
{/if}

<style>
	.page-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1rem 1rem 2rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.8rem;
		margin-bottom: 0.75rem;
		transition: color 0.2s;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.back-link:hover {
		color: var(--accent);
	}

	/* Header */
	.series-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	@media (min-width: 640px) {
		.series-header {
			flex-direction: row;
			align-items: flex-start;
			justify-content: space-between;
		}
	}

	.header-left {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.series-icon {
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 0.5rem;
		background-color: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.series-icon :global(svg) {
		width: 2rem;
		height: 2rem;
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.series-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.series-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.meta-item.muted {
		color: var(--text-muted);
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-secondary,
	.btn-danger,
	.btn-primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		text-decoration: none;
		border: none;
	}

	.btn-secondary {
		background-color: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.btn-secondary:hover {
		background-color: var(--bg-hover);
	}

	.btn-danger {
		background-color: transparent;
		color: var(--error, #ef4444);
		border: 1px solid var(--error, #ef4444);
	}

	.btn-danger:hover {
		background-color: rgba(239, 68, 68, 0.1);
	}

	.btn-primary {
		background-color: var(--accent);
		color: white;
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	/* Compact Stats Bar */
	.stats-bar {
		background-color: var(--bg-secondary);
		border-radius: 0.5rem;
		border: 1px solid var(--border-color);
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
	}

	.progress-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.progress-stats {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.stat-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.stat-inline strong {
		color: var(--text-primary);
	}

	.stat-inline.rating {
		color: #f59e0b;
		font-weight: 600;
	}

	.stat-inline.muted {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.progress-percent {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--accent);
	}

	.progress-percent.complete {
		color: var(--success, #10b981);
	}

	.progress-bar {
		height: 6px;
		background-color: var(--bg-tertiary);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--accent);
		transition: width 0.3s ease;
	}

	.progress-fill.complete {
		background-color: var(--success, #10b981);
	}

	.status-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
		font-size: 0.8rem;
	}

	.status-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--text-secondary);
	}

	.status-inline.highlight {
		color: var(--accent);
	}

	.status-inline.highlight strong {
		font-weight: 500;
	}

	.status-inline.complete {
		color: var(--success, #10b981);
		font-weight: 500;
	}

	.status-inline.muted {
		color: var(--text-muted);
	}

	.status-inline.warning {
		color: #d97706;
		cursor: help;
	}

	/* Details Grid - Compact layout for Description, Notes, Tags */
	.details-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 900px) {
		.details-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 600px) {
		.details-grid {
			grid-template-columns: 1fr;
		}
	}

	.detail-card {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		padding: 0.75rem;
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.detail-title {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.edit-icon-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 0.25rem;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.edit-icon-btn:hover {
		color: var(--accent);
		background-color: var(--bg-tertiary);
	}

	.edit-icon-btn.active {
		color: var(--accent);
		background-color: var(--bg-tertiary);
	}

	.detail-content-btn {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.detail-text {
		display: block;
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.5;
		white-space: pre-wrap;
		max-height: 4.5em;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.detail-placeholder {
		color: var(--text-muted);
		font-style: italic;
		font-size: 0.875rem;
	}

	/* Inline Edit - Compact */
	.inline-edit {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.edit-textarea {
		width: 100%;
		padding: 0.5rem;
		background-color: var(--bg-tertiary);
		border: 1px solid var(--accent);
		border-radius: 0.375rem;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.875rem;
		line-height: 1.5;
		resize: vertical;
	}

	.edit-textarea:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.15);
	}

	.edit-textarea::placeholder {
		color: var(--text-muted);
	}

	.edit-actions {
		display: flex;
		gap: 0.375rem;
	}

	.btn-save-sm,
	.btn-cancel-sm {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		font-weight: 500;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.btn-save-sm {
		background-color: var(--success, #10b981);
		color: white;
	}

	.btn-save-sm:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-save-sm:disabled,
	.btn-cancel-sm:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-cancel-sm {
		background-color: var(--bg-tertiary);
		color: var(--text-muted);
	}

	.btn-cancel-sm:hover:not(:disabled) {
		color: var(--text-primary);
	}

	/* Tags - Compact */
	.tags-display {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		min-height: 1.5rem;
		align-items: center;
	}

	.tag-badge-sm {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 500;
		color: white;
	}

	.no-tags {
		color: var(--text-muted);
		font-style: italic;
		font-size: 0.75rem;
	}

	.no-tags a {
		color: var(--accent);
		text-decoration: none;
	}

	.no-tags a:hover {
		text-decoration: underline;
	}

	.tag-picker-compact {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-color);
	}

	.tag-picker-item-sm {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 500;
		color: white;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s;
		opacity: 0.6;
	}

	.tag-picker-item-sm:hover:not(:disabled) {
		opacity: 1;
	}

	.tag-picker-item-sm.selected {
		opacity: 1;
		border-color: rgba(255, 255, 255, 0.5);
	}

	.tag-picker-item-sm:disabled {
		cursor: wait;
		opacity: 0.4;
	}

	/* Books Section */
	.books-section {
		margin-top: 1rem;
	}

	.books-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.books-header .section-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		border-radius: 0.5rem;
		border: none;
		background-color: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s;
	}

	.control-btn:hover {
		background-color: var(--bg-secondary);
		color: var(--text-primary);
	}

	.control-btn.active {
		background-color: var(--accent);
		color: white;
	}

	.view-toggle {
		display: flex;
		border-radius: 0.5rem;
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.5rem;
		border: none;
		background-color: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s;
	}

	.toggle-btn:hover {
		background-color: var(--bg-secondary);
		color: var(--text-primary);
	}

	.toggle-btn.active {
		background-color: var(--bg-secondary);
		color: var(--text-primary);
	}

	.books-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.books-grid {
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		}
	}

	.books-list {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.books-list > :global(*:not(:last-child)) {
		border-bottom: 1px solid var(--border-color);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.empty-state p {
		margin: 0;
	}
</style>
