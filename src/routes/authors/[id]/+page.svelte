<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import {
		User,
		BookOpen,
		Edit2,
		Trash2,
		Star,
		ArrowLeft,
		Plus,
		Library,
		Globe,
		Calendar,
		MapPin,
		ExternalLink,
		Check,
		Pencil,
		Grid,
		List,
		SquareCheck,
		Tag,
		X
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
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	let deleting = $state(false);

	// View mode and selection state
	let viewMode = $state<'grid' | 'list'>('grid');
	let selectMode = $state(false);
	let showTagModal = $state(false);
	let showStatusModal = $state(false);
	let showDeleteModal = $state(false);

	// Inline editing state
	let editingBio = $state(false);
	let editingNotes = $state(false);
	let savingBio = $state(false);
	let savingNotes = $state(false);
	let editingTags = $state(false);
	let togglingTag = $state<number | null>(null);

	// Keep a local copy of author tags for immediate UI updates
	let authorTags = $state(data.authorTags);

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

	// Local editable copies
	let editBioValue = $state('');
	let editNotesValue = $state('');

	// Initialize edit values when editing starts
	function startEditBio() {
		editBioValue = data.author.bio || '';
		editingBio = true;
	}

	function startEditNotes() {
		editNotesValue = data.author.comments || '';
		editingNotes = true;
	}

	async function saveBio() {
		savingBio = true;
		try {
			const res = await fetch(`/api/authors/${data.author.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bio: editBioValue })
			});
			if (res.ok) {
				toasts.success('Biography saved');
				editingBio = false;
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save biography');
			}
		} finally {
			savingBio = false;
		}
	}

	async function saveNotes() {
		savingNotes = true;
		try {
			const res = await fetch(`/api/authors/${data.author.id}`, {
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

	function cancelBioEdit() {
		editingBio = false;
	}

	function cancelNotesEdit() {
		editingNotes = false;
	}

	async function toggleTag(tagId: number) {
		togglingTag = tagId;
		try {
			const res = await fetch('/api/tags/toggle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ authorId: data.author.id, tagId })
			});
			if (res.ok) {
				const result = await res.json();
				if (result.action === 'added') {
					const addedTag = data.options.tags.find(t => t.id === tagId);
					if (addedTag) {
						authorTags = [...authorTags, addedTag];
					}
					toasts.success('Tag added');
				} else {
					authorTags = authorTags.filter(t => t.id !== tagId);
					toasts.success('Tag removed');
				}
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to toggle tag');
			}
		} finally {
			togglingTag = null;
		}
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this author? This will not delete their books.')) {
			return;
		}
		deleting = true;
		try {
			const res = await fetch(`/api/authors/${data.author.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				toasts.success('Author deleted');
				goto('/authors');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to delete author');
			}
		} finally {
			deleting = false;
		}
	}

</script>

<svelte:head>
	<title>{data.author.name} - BookShelf</title>
</svelte:head>

<div class="page-container">
	<!-- Back navigation -->
	<button type="button" onclick={() => history.back()} class="back-link">
		<ArrowLeft class="w-4 h-4" />
		Back
	</button>

	<!-- Header section -->
	<div class="author-header">
		<div class="header-left">
			{#if data.author.photoUrl}
				<img src={data.author.photoUrl} alt={data.author.name} class="author-photo" />
			{:else}
				<div class="author-photo-placeholder">
					<User class="w-12 h-12" />
				</div>
			{/if}
			<div class="header-info">
				<h1 class="author-name">{data.author.name}</h1>
				<div class="author-meta">
					{#if data.author.birthPlace}
						<span class="meta-item">
							<MapPin class="w-3.5 h-3.5" />
							{data.author.birthPlace}
						</span>
					{/if}
					{#if data.author.birthDate}
						<span class="meta-item">
							<Calendar class="w-3.5 h-3.5" />
							Born {formatDate(data.author.birthDate)}
							{#if data.author.deathDate}
								- Died {formatDate(data.author.deathDate)}
							{/if}
						</span>
					{/if}
				</div>
				<div class="author-links">
					{#if data.author.website}
						<a href={data.author.website} target="_blank" rel="noopener noreferrer" class="author-link">
							<Globe class="w-3.5 h-3.5" />
							Website
							<ExternalLink class="w-3 h-3" />
						</a>
					{/if}
					{#if data.author.wikipediaUrl}
						<a href={data.author.wikipediaUrl} target="_blank" rel="noopener noreferrer" class="author-link">
							<DynamicIcon icon="fab fa-wikipedia-w" size={12} />
							Wikipedia
							<ExternalLink class="w-3 h-3" />
						</a>
					{/if}
				</div>
			</div>
		</div>
		<div class="header-actions">
			<a href="/authors/{data.author.id}/edit" class="btn-secondary">
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
					<strong>{data.author.readCount}</strong>/<strong>{data.author.bookCount}</strong> read
				</span>
				{#if data.author.averageRating}
					<span class="stat-inline rating">
						<Star class="w-3.5 h-3.5" style="fill: #f59e0b; color: #f59e0b;" />
						{data.author.averageRating}
					</span>
				{/if}
				{#if data.series.length > 0}
					<span class="stat-inline muted">{data.series.length} series</span>
				{/if}
			</div>
			<span class="progress-percent {data.author.completionPercentage === 100 ? 'complete' : ''}">
				{data.author.completionPercentage}%
			</span>
		</div>
		<div class="progress-bar">
			<div
				class="progress-fill {data.author.completionPercentage === 100 ? 'complete' : ''}"
				style="width: {data.author.completionPercentage}%"
			></div>
		</div>

		<!-- Status row -->
		<div class="status-row">
			{#if data.author.completionPercentage === 100}
				<span class="status-inline complete">
					<i class="fas fa-check-circle"></i> All books read!
				</span>
			{:else if data.author.bookCount - data.author.readCount > 0}
				<span class="status-inline muted">
					{data.author.bookCount - data.author.readCount} left to read
				</span>
			{/if}
		</div>
	</div>

	<!-- Bio, Notes & Series in a compact grid -->
	<div class="details-grid">
		<!-- Biography -->
		<div class="detail-card">
			<div class="detail-header">
				<h3 class="detail-title">Biography</h3>
				{#if !editingBio}
					<button type="button" class="edit-icon-btn" onclick={startEditBio} title="Edit">
						<Pencil class="w-3 h-3" />
					</button>
				{/if}
			</div>
			{#if editingBio}
				<div class="inline-edit">
					<textarea
						class="edit-textarea"
						bind:value={editBioValue}
						placeholder="Add a biography..."
						rows="3"
					></textarea>
					<div class="edit-actions">
						<button type="button" class="btn-save-sm" onclick={saveBio} disabled={savingBio}>
							<Check class="w-3 h-3" />
							{savingBio ? 'Saving...' : 'Save'}
						</button>
						<button type="button" class="btn-cancel-sm" onclick={cancelBioEdit} disabled={savingBio}>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<button type="button" class="detail-content-btn" onclick={startEditBio}>
					{#if data.author.bio}
						<span class="detail-text">{data.author.bio}</span>
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
					{#if data.author.comments}
						<span class="detail-text">{data.author.comments}</span>
					{:else}
						<span class="detail-placeholder">Click to add...</span>
					{/if}
				</button>
			{/if}
		</div>

		<!-- Series -->
		<div class="detail-card">
			<div class="detail-header">
				<h3 class="detail-title">Series</h3>
			</div>
			<div class="series-display">
				{#if data.series.length > 0}
					{#each data.series as seriesItem (seriesItem.id)}
						<a href="/series/{seriesItem.id}" class="series-link">
							<Library class="w-3 h-3" />
							{seriesItem.title}
							<span class="series-count">({seriesItem.bookCount})</span>
						</a>
					{/each}
				{:else}
					<span class="no-series">No series</span>
				{/if}
			</div>
		</div>

		<!-- Tags -->
		<div class="detail-card">
			<div class="detail-header">
				<h3 class="detail-title">Tags</h3>
				<button type="button" class="edit-icon-btn" onclick={() => editingTags = !editingTags} title={editingTags ? 'Done' : 'Edit tags'}>
					{#if editingTags}
						<Check class="w-3 h-3" />
					{:else}
						<Pencil class="w-3 h-3" />
					{/if}
				</button>
			</div>
			<div class="tags-display">
				{#if editingTags}
					<!-- Show all tags with toggle buttons -->
					<div class="tags-edit-grid">
						{#each data.options.tags as tag (tag.id)}
							{@const isSelected = authorTags.some(t => t.id === tag.id)}
							<button
								type="button"
								class="tag-toggle"
								class:selected={isSelected}
								disabled={togglingTag === tag.id}
								onclick={() => toggleTag(tag.id)}
								style="--tag-color: {tag.color || '#6c757d'}"
							>
								{#if tag.icon}
									<DynamicIcon icon={tag.icon} size={12} />
								{:else}
									<span class="tag-dot" style="background-color: {tag.color || '#6c757d'}"></span>
								{/if}
								{tag.name}
								{#if isSelected}
									<X class="w-3 h-3 remove-icon" />
								{/if}
							</button>
						{/each}
					</div>
				{:else}
					<!-- Show current tags -->
					{#if authorTags.length > 0}
						<div class="tags-list">
							{#each authorTags as tag (tag.id)}
								<a href="/authors?tag={tag.id}" class="author-tag" style="--tag-color: {tag.color || '#6c757d'}">
									{#if tag.icon}
										<DynamicIcon icon={tag.icon} size={12} />
									{:else}
										<span class="tag-dot" style="background-color: {tag.color || '#6c757d'}"></span>
									{/if}
									{tag.name}
								</a>
							{/each}
						</div>
					{:else}
						<button type="button" class="detail-content-btn" onclick={() => editingTags = true}>
							<span class="detail-placeholder">Click to add tags...</span>
						</button>
					{/if}
				{/if}
			</div>
		</div>
	</div>

	<!-- Books Section -->
	<div class="books-section">
		<div class="books-header">
			<h2 class="section-title">
				<BookOpen class="w-5 h-5" />
				Books ({data.books.length})
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

				<a href="/books?add=true&authorId={data.author.id}" class="btn-primary">
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
							showAuthor={false}
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
						showSeries={true}
						allSelected={bookIds.every(id => $selectedIds.includes(id))}
						onSelectAll={handleSelectAll}
					/>
					{#each data.books as book (book.id)}
						<BookRow
							{book}
							showAuthor={false}
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
				<p>No books by this author yet</p>
				<a href="/books?add=true&authorId={data.author.id}" class="btn-primary">
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
	onAddTags={() => showTagModal = true}
	onChangeStatus={() => showStatusModal = true}
	onDelete={() => showDeleteModal = true}
	onComplete={() => invalidateAll()}
	authors={data.options.authors}
	narrators={data.options.narrators}
	series={data.options.series}
	formats={data.options.formats}
	genres={data.options.genres}
/>

<!-- Bulk Modals -->
{#if showTagModal}
	<BulkTagModal
		bookIds={$selectedIds}
		tags={data.options.tags}
		onClose={() => showTagModal = false}
		onComplete={() => {
			showTagModal = false;
			invalidateAll();
		}}
	/>
{/if}

{#if showStatusModal}
	<BulkStatusModal
		bookIds={$selectedIds}
		statuses={data.options.statuses}
		onClose={() => showStatusModal = false}
		onComplete={() => {
			showStatusModal = false;
			invalidateAll();
		}}
	/>
{/if}

{#if showDeleteModal}
	<BulkDeleteModal
		bookIds={$selectedIds}
		bookTitles={selectedBookTitles}
		onClose={() => showDeleteModal = false}
		onComplete={() => {
			showDeleteModal = false;
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
	.author-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	@media (min-width: 640px) {
		.author-header {
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

	.author-photo {
		width: 5rem;
		height: 5rem;
		border-radius: 0.5rem;
		object-fit: cover;
		flex-shrink: 0;
	}

	.author-photo-placeholder {
		width: 5rem;
		height: 5rem;
		border-radius: 0.5rem;
		background-color: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.author-name {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.author-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.author-links {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.author-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--accent);
		text-decoration: none;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		background-color: rgba(var(--accent-rgb), 0.1);
		transition: background-color 0.2s;
	}

	.author-link:hover {
		background-color: rgba(var(--accent-rgb), 0.2);
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

	.status-inline.complete {
		color: var(--success, #10b981);
		font-weight: 500;
	}

	.status-inline.muted {
		color: var(--text-muted);
	}

	/* Details Grid - Compact layout for Bio, Notes, Series, Tags */
	.details-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 1100px) {
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

	/* Series - Compact */
	.series-display {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		min-height: 1.5rem;
		align-items: center;
	}

	.series-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--accent);
		background-color: rgba(var(--accent-rgb), 0.1);
		text-decoration: none;
		transition: all 0.2s;
	}

	.series-link:hover {
		background-color: rgba(var(--accent-rgb), 0.2);
	}

	.series-link .series-count {
		color: var(--text-muted);
		font-weight: 400;
	}

	.no-series {
		color: var(--text-muted);
		font-style: italic;
		font-size: 0.75rem;
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

	/* Tags */
	.tags-display {
		min-height: 1.5rem;
	}

	.tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.author-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--tag-color);
		background-color: color-mix(in srgb, var(--tag-color) 15%, transparent);
		text-decoration: none;
		transition: all 0.2s;
	}

	.author-tag:hover {
		background-color: color-mix(in srgb, var(--tag-color) 25%, transparent);
	}

	.tag-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.tags-edit-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.tag-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--border-color);
		background-color: var(--bg-tertiary);
		color: var(--text-secondary);
		transition: all 0.2s;
	}

	.tag-toggle:hover:not(:disabled) {
		border-color: var(--tag-color);
		background-color: color-mix(in srgb, var(--tag-color) 10%, transparent);
	}

	.tag-toggle.selected {
		border-color: var(--tag-color);
		background-color: color-mix(in srgb, var(--tag-color) 20%, transparent);
		color: var(--tag-color);
	}

	.tag-toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tag-toggle .remove-icon {
		margin-left: 0.125rem;
		opacity: 0.7;
	}

	.tag-toggle:hover .remove-icon {
		opacity: 1;
	}
</style>
