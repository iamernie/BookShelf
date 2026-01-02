<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { Library, BookOpen, Edit2, Trash2, Star, TrendingUp, AlertTriangle } from 'lucide-svelte';
	import type { Series } from '$lib/server/db/schema';
	import type { SeriesStats } from '$lib/server/services/seriesService';

	let {
		series,
		books = [],
		stats,
		mode = 'view',
		onClose,
		onSave,
		onDelete
	}: {
		series: Series | null;
		books?: { id: number; title: string; coverImageUrl: string | null; bookNum: number | null }[];
		stats?: SeriesStats;
		mode: 'view' | 'edit' | 'add';
		onClose: () => void;
		onSave: (data: Partial<Series>) => Promise<void>;
		onDelete?: () => Promise<void>;
	} = $props();

	let currentMode = $state(mode);
	let saving = $state(false);
	let deleting = $state(false);

	// Form fields
	let title = $state(series?.title || '');
	let description = $state(series?.description || '');
	let numBooks = $state(series?.numBooks?.toString() || '');
	let comments = $state(series?.comments || '');

	async function handleSave() {
		if (!title.trim()) return;
		saving = true;
		try {
			await onSave({
				title: title.trim(),
				description: description.trim() || null,
				numBooks: numBooks ? parseInt(numBooks) : null,
				comments: comments.trim() || null
			});
			onClose();
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!onDelete || !confirm('Are you sure you want to delete this series?')) return;
		deleting = true;
		try {
			await onDelete();
			onClose();
		} finally {
			deleting = false;
		}
	}
</script>

<Modal open={true} onClose={onClose} title={currentMode === 'add' ? 'Add Series' : series?.title || 'Series'} size="lg">
	{#if currentMode === 'view' && series}
		<!-- View Mode -->
		<div class="modal-content">
			<div class="series-header">
				<div class="series-icon">
					<Library class="w-10 h-10" style="color: var(--accent);" />
				</div>

				<div class="series-meta">
					{#if series.numBooks}
						<p class="meta-text">
							{series.numBooks} books in series
						</p>
					{/if}
				</div>
			</div>

			<!-- Statistics Grid -->
			{#if stats}
				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-value">{stats.totalBooks}</div>
						<div class="stat-label">Total Books</div>
					</div>
					<div class="stat-card">
						<div class="stat-value">{stats.readBooks}</div>
						<div class="stat-label">Books Read</div>
					</div>
					<div class="stat-card">
						<div class="stat-value {stats.unreadBooks === 0 ? 'complete' : ''}">
							{#if stats.unreadBooks === 0}
								<i class="fas fa-check-circle"></i>
							{:else}
								{stats.unreadBooks}
							{/if}
						</div>
						<div class="stat-label">{stats.unreadBooks === 0 ? 'All Read!' : 'Left to Read'}</div>
					</div>
					<div class="stat-card">
						<div class="stat-value">
							{#if stats.averageRating}
								<Star class="w-4 h-4 inline-block fill-yellow-400 text-yellow-400" />
								{stats.averageRating}
							{:else}
								<span class="no-data">-</span>
							{/if}
						</div>
						<div class="stat-label">Average Rating</div>
					</div>
					{#if stats.totalPages > 0}
						<div class="stat-card">
							<div class="stat-value">{stats.totalPages.toLocaleString()}</div>
							<div class="stat-label">Total Pages</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">~{stats.avgPages}</div>
							<div class="stat-label">Avg Pages/Book</div>
						</div>
					{/if}
					{#if stats.lastReadBook}
						<div class="stat-card">
							<div class="stat-value text-small">{stats.lastReadBook}</div>
							<div class="stat-label">Last Read</div>
						</div>
					{/if}
					{#if stats.nextBook}
						<div class="stat-card">
							<div class="stat-value text-small">{stats.nextBook}</div>
							<div class="stat-label">Next Up</div>
						</div>
					{/if}
					<!-- Completion Progress -->
					<div class="stat-card wide">
						<div class="stat-value">
							<span>{stats.readBooks}/{stats.totalBooks}</span>
							<span class="completion-percent {stats.completionPercentage === 100 ? 'complete' : ''}">
								({stats.completionPercentage}%)
							</span>
						</div>
						<div class="progress-bar">
							<div
								class="progress-fill {stats.completionPercentage === 100 ? 'complete' : ''}"
								style="width: {stats.completionPercentage}%"
							></div>
						</div>
						<div class="stat-label">Completion Progress</div>
					</div>
				</div>

				<!-- Gap Warning -->
				{#if stats.gapAnalysis.hasGaps}
					<div class="gap-warning">
						<div class="gap-header">
							<AlertTriangle class="w-5 h-5" />
							<span>Missing Books in Series</span>
						</div>
						<p class="gap-text">
							Your collection is missing <strong>{stats.gapAnalysis.missingBooks.length}</strong>
							book{stats.gapAnalysis.missingBooks.length > 1 ? 's' : ''} from this series:
						</p>
						<div class="missing-books">
							{#each stats.gapAnalysis.missingBooks as num}
								<span class="missing-badge">Book #{num}</span>
							{/each}
						</div>
					</div>
				{/if}
			{/if}

			{#if series.description}
				<div class="content-section">
					<h3 class="section-label">Description</h3>
					<p class="section-text">{series.description}</p>
				</div>
			{/if}

			{#if series.comments}
				<div class="content-section">
					<h3 class="section-label">Notes</h3>
					<p class="section-text">{series.comments}</p>
				</div>
			{/if}

			{#if books.length > 0}
				<div class="content-section">
					<h3 class="section-label books-label">
						<BookOpen class="w-4 h-4" />
						Books ({books.length})
					</h3>
					<div class="books-list">
						{#each books as book}
							<a href="/books/{book.id}" class="book-item">
								<img
									src={book.coverImageUrl || '/placeholder.png'}
									alt={book.title}
									class="book-cover"
									onerror={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
								/>
								<div class="book-info">
									<span class="book-num">#{book.bookNum || '?'}</span>
									<span class="book-title">{book.title}</span>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Action buttons -->
			<div class="action-buttons">
				<button
					type="button"
					class="btn-delete"
					onclick={handleDelete}
					disabled={deleting}
				>
					<Trash2 class="w-4 h-4" />
					Delete
				</button>
				<button
					type="button"
					class="btn-edit"
					onclick={() => currentMode = 'edit'}
				>
					<Edit2 class="w-4 h-4" />
					Edit
				</button>
			</div>
		</div>
	{:else}
		<!-- Edit/Add Mode -->
		<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="modal-content form-mode">
			<div class="form-group">
				<label for="title" class="form-label">Title *</label>
				<input
					id="title"
					type="text"
					bind:value={title}
					required
					class="form-input"
				/>
			</div>

			<div class="form-group">
				<label for="description" class="form-label">Description</label>
				<textarea
					id="description"
					bind:value={description}
					rows="4"
					class="form-input"
				></textarea>
			</div>

			<div class="form-group">
				<label for="numBooks" class="form-label">Number of Books</label>
				<input
					id="numBooks"
					type="number"
					min="0"
					bind:value={numBooks}
					class="form-input"
				/>
			</div>

			<div class="form-group">
				<label for="comments" class="form-label">Notes</label>
				<textarea
					id="comments"
					bind:value={comments}
					rows="3"
					class="form-input"
				></textarea>
			</div>

			<!-- Form buttons -->
			<div class="form-buttons">
				<button
					type="button"
					class="btn-cancel"
					onclick={() => currentMode === 'add' ? onClose() : currentMode = 'view'}
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={saving || !title.trim()}
					class="btn-save"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</form>
	{/if}
</Modal>

<style>
	.modal-content {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.modal-content.form-mode {
		gap: 1rem;
	}

	.series-header {
		display: flex;
		align-items: flex-start;
		gap: 1.5rem;
	}

	.series-icon {
		width: 5rem;
		height: 5rem;
		border-radius: 0.5rem;
		background-color: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.series-meta {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.meta-text {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.content-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.section-label.books-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.section-text {
		color: var(--text-primary);
		white-space: pre-wrap;
	}

	.books-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.book-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		text-decoration: none;
		transition: background-color 0.2s;
	}

	.book-item:hover {
		background-color: var(--bg-hover);
	}

	.book-cover {
		width: 2.5rem;
		height: 3.5rem;
		object-fit: cover;
		border-radius: 0.25rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.book-cover-placeholder {
		width: 2.5rem;
		height: 3.5rem;
		background-color: var(--bg-tertiary);
		border-radius: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.book-info {
		flex: 1;
		min-width: 0;
	}

	.book-num {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-right: 0.5rem;
	}

	.book-title {
		color: var(--text-primary);
	}

	.action-buttons {
		display: flex;
		justify-content: space-between;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.btn-delete {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		color: var(--error);
		background: transparent;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-delete:hover {
		background-color: rgba(239, 68, 68, 0.1);
	}

	.btn-edit {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: var(--accent);
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.btn-edit:hover {
		opacity: 0.9;
	}

	/* Form styles */
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.form-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.form-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		color: var(--text-primary);
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
	}

	.form-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.btn-cancel {
		padding: 0.5rem 1rem;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-cancel:hover {
		background-color: var(--bg-hover);
	}

	.btn-save {
		padding: 0.5rem 1rem;
		background-color: var(--accent);
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.btn-save:hover {
		opacity: 0.9;
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.stat-card {
		background-color: var(--bg-tertiary);
		border-radius: 0.5rem;
		padding: 0.75rem;
		text-align: center;
	}

	.stat-card.wide {
		grid-column: span 2;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--accent);
		line-height: 1.2;
	}

	.stat-value.complete {
		color: var(--success, #10b981);
	}

	.stat-value.text-small {
		font-size: 0.875rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stat-value .no-data {
		color: var(--text-muted);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.completion-percent {
		margin-left: 0.5rem;
	}

	.completion-percent.complete {
		color: var(--success, #10b981);
	}

	.progress-bar {
		height: 6px;
		background-color: var(--border-color);
		border-radius: 3px;
		overflow: hidden;
		margin-top: 0.5rem;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--accent);
		transition: width 0.3s ease;
	}

	.progress-fill.complete {
		background-color: var(--success, #10b981);
	}

	/* Gap Warning */
	.gap-warning {
		background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%);
		border: 1px solid rgba(251, 191, 36, 0.4);
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.gap-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		color: #d97706;
		margin-bottom: 0.5rem;
	}

	.gap-text {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0 0 0.75rem 0;
	}

	.missing-books {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.missing-badge {
		background-color: var(--bg-secondary);
		border: 1px solid rgba(251, 191, 36, 0.4);
		border-radius: 9999px;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		color: #d97706;
	}
</style>
