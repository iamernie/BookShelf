<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import {
		Mic,
		Edit2,
		Trash2,
		Star,
		ArrowLeft,
		Globe,
		Calendar,
		MapPin,
		ExternalLink,
		Check,
		Pencil,
		Grid,
		List,
		Headphones,
		BookOpen,
		X
	} from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import { toasts } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	let deleting = $state(false);

	// View mode
	let viewMode = $state<'grid' | 'list'>('grid');

	// Inline editing state
	let editingBio = $state(false);
	let editingNotes = $state(false);
	let savingBio = $state(false);
	let savingNotes = $state(false);
	let editingTags = $state(false);
	let togglingTag = $state<number | null>(null);

	// Keep a local copy of narrator tags for immediate UI updates
	let narratorTags = $state(data.narratorTags);

	// Local editable copies
	let editBioValue = $state('');
	let editNotesValue = $state('');

	// Initialize edit values when editing starts
	function startEditBio() {
		editBioValue = data.narrator.bio || '';
		editingBio = true;
	}

	function startEditNotes() {
		editNotesValue = data.narrator.comments || '';
		editingNotes = true;
	}

	async function saveBio() {
		savingBio = true;
		try {
			const res = await fetch(`/api/narrators/${data.narrator.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: data.narrator.name, bio: editBioValue })
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
			const res = await fetch(`/api/narrators/${data.narrator.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: data.narrator.name, comments: editNotesValue })
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
			const res = await fetch(`/api/narrators/${data.narrator.id}/tags`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tagId })
			});
			if (res.ok) {
				const result = await res.json();
				if (result.action === 'added') {
					const addedTag = data.options.tags.find(t => t.id === tagId);
					if (addedTag) {
						narratorTags = [...narratorTags, addedTag];
					}
					toasts.success('Tag added');
				} else {
					narratorTags = narratorTags.filter(t => t.id !== tagId);
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
		if (!confirm('Are you sure you want to delete this narrator? This will not delete their audiobooks.')) {
			return;
		}
		deleting = true;
		try {
			const res = await fetch(`/api/narrators/${data.narrator.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				toasts.success('Narrator deleted');
				goto('/narrators');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to delete narrator');
			}
		} finally {
			deleting = false;
		}
	}

	function openAudiobook(audiobook: { id: number; bookId: number | null }) {
		if (audiobook.bookId) {
			goto(`/books/${audiobook.bookId}`);
		} else {
			goto(`/audiobooks/${audiobook.id}`);
		}
	}
</script>

<svelte:head>
	<title>{data.narrator.name} - BookShelf</title>
</svelte:head>

<div class="page-container">
	<!-- Back navigation -->
	<button type="button" onclick={() => history.back()} class="back-link">
		<ArrowLeft class="w-4 h-4" />
		Back
	</button>

	<!-- Header section -->
	<div class="narrator-header">
		<div class="header-left">
			{#if data.narrator.photoUrl}
				<img src={data.narrator.photoUrl} alt={data.narrator.name} class="narrator-photo" />
			{:else}
				<div class="narrator-photo-placeholder">
					<Mic class="w-12 h-12" />
				</div>
			{/if}
			<div class="header-info">
				<h1 class="narrator-name">{data.narrator.name}</h1>
				<div class="narrator-meta">
					{#if data.narrator.birthPlace}
						<span class="meta-item">
							<MapPin class="w-3.5 h-3.5" />
							{data.narrator.birthPlace}
						</span>
					{/if}
					{#if data.narrator.birthDate}
						<span class="meta-item">
							<Calendar class="w-3.5 h-3.5" />
							Born {formatDate(data.narrator.birthDate)}
							{#if data.narrator.deathDate}
								- Died {formatDate(data.narrator.deathDate)}
							{/if}
						</span>
					{/if}
				</div>
				<div class="narrator-links">
					{#if data.narrator.website}
						<a href={data.narrator.website} target="_blank" rel="noopener noreferrer" class="narrator-link">
							<Globe class="w-3.5 h-3.5" />
							Website
							<ExternalLink class="w-3 h-3" />
						</a>
					{/if}
					{#if data.narrator.wikipediaUrl}
						<a href={data.narrator.wikipediaUrl} target="_blank" rel="noopener noreferrer" class="narrator-link">
							<DynamicIcon icon="fab fa-wikipedia-w" size={12} />
							Wikipedia
							<ExternalLink class="w-3 h-3" />
						</a>
					{/if}
				</div>
			</div>
		</div>
		<div class="header-actions">
			<a href="/narrators/{data.narrator.id}/edit" class="btn-secondary">
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
		<div class="progress-row">
			<div class="progress-stats">
				<span class="stat-inline">
					<Headphones class="w-3.5 h-3.5" />
					<strong>{data.narrator.audiobookCount}</strong> audiobook{data.narrator.audiobookCount !== 1 ? 's' : ''}
				</span>
				{#if data.narrator.avgRating}
					<span class="stat-inline rating">
						<Star class="w-3.5 h-3.5" style="fill: #f59e0b; color: #f59e0b;" />
						{data.narrator.avgRating}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Bio, Notes & Tags in a compact grid -->
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
					{#if data.narrator.bio}
						<span class="detail-text">{data.narrator.bio}</span>
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
					{#if data.narrator.comments}
						<span class="detail-text">{data.narrator.comments}</span>
					{:else}
						<span class="detail-placeholder">Click to add...</span>
					{/if}
				</button>
			{/if}
		</div>

		<!-- Tags -->
		<div class="detail-card detail-card-wide">
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
							{@const isSelected = narratorTags.some(t => t.id === tag.id)}
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
					{#if narratorTags.length > 0}
						<div class="tags-list">
							{#each narratorTags as tag (tag.id)}
								<a href="/narrators?tag={tag.id}" class="narrator-tag" style="--tag-color: {tag.color || '#6c757d'}">
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
	{#if data.books && data.books.length > 0}
		<div class="audiobooks-section">
			<div class="audiobooks-header">
				<h2 class="section-title">
					<BookOpen class="w-5 h-5" />
					Books ({data.books.length})
				</h2>
			</div>

			<div class="audiobooks-grid">
				{#each data.books as book (book.id)}
					<a href="/books/{book.id}" class="audiobook-card">
						{#if book.coverImageUrl}
							<img
								src={book.coverImageUrl}
								alt={book.title}
								class="audiobook-cover"
							/>
						{:else}
							<div class="audiobook-cover-placeholder">
								<BookOpen class="w-8 h-8" />
							</div>
						{/if}
						<div class="audiobook-title">{book.title}</div>
						{#if book.rating}
							<div class="book-rating">
								<Star class="w-3 h-3" style="color: #fbbf24; fill: #fbbf24;" />
								<span>{book.rating}</span>
							</div>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Audiobooks Section -->
	<div class="audiobooks-section">
		<div class="audiobooks-header">
			<h2 class="section-title">
				<Headphones class="w-5 h-5" />
				Audiobooks ({data.audiobooks.length})
			</h2>
			<div class="header-controls">
				{#if data.audiobooks.length > 0}
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
			</div>
		</div>

		{#if data.audiobooks.length > 0}
			{#if viewMode === 'grid'}
				<div class="audiobooks-grid">
					{#each data.audiobooks as audiobook (audiobook.id)}
						<button
							type="button"
							class="audiobook-card"
							onclick={() => openAudiobook(audiobook)}
						>
							{#if audiobook.coverPath}
								<img
									src={audiobook.coverPath}
									alt={audiobook.title}
									class="audiobook-cover"
								/>
							{:else}
								<div class="audiobook-cover-placeholder">
									<Headphones class="w-8 h-8" />
								</div>
							{/if}
							<div class="audiobook-title">{audiobook.title}</div>
						</button>
					{/each}
				</div>
			{:else}
				<div class="audiobooks-list">
					{#each data.audiobooks as audiobook (audiobook.id)}
						<button
							type="button"
							class="audiobook-row"
							onclick={() => openAudiobook(audiobook)}
						>
							{#if audiobook.coverPath}
								<img
									src={audiobook.coverPath}
									alt={audiobook.title}
									class="audiobook-row-cover"
								/>
							{:else}
								<div class="audiobook-row-cover-placeholder">
									<Headphones class="w-4 h-4" />
								</div>
							{/if}
							<span class="audiobook-row-title">{audiobook.title}</span>
						</button>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="empty-state">
				<Headphones class="w-12 h-12" />
				<p>No audiobooks by this narrator yet</p>
			</div>
		{/if}
	</div>
</div>

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
	.narrator-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	@media (min-width: 640px) {
		.narrator-header {
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

	.narrator-photo {
		width: 5rem;
		height: 5rem;
		border-radius: 0.5rem;
		object-fit: cover;
		flex-shrink: 0;
	}

	.narrator-photo-placeholder {
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

	.narrator-name {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.narrator-meta {
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

	.narrator-links {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.narrator-link {
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

	.narrator-link:hover {
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

	/* Details Grid - Compact layout for Bio, Notes, Tags */
	.details-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 900px) {
		.details-grid {
			grid-template-columns: 1fr 1fr;
		}
		.detail-card-wide {
			grid-column: span 2;
		}
	}

	@media (max-width: 600px) {
		.details-grid {
			grid-template-columns: 1fr;
		}
		.detail-card-wide {
			grid-column: span 1;
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

	/* Audiobooks Section */
	.audiobooks-section {
		margin-top: 1rem;
	}

	.audiobooks-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.audiobooks-header .section-title {
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

	.audiobooks-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.audiobooks-grid {
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		}
	}

	.audiobook-card {
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		padding: 0;
		transition: transform 0.2s;
	}

	.audiobook-card:hover {
		transform: translateY(-2px);
	}

	.audiobook-cover {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 0.5rem;
		background-color: var(--bg-tertiary);
	}

	.audiobook-cover-placeholder {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 0.5rem;
		background-color: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.audiobook-title {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.book-rating {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.audiobooks-list {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.audiobook-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-color);
		width: 100%;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.2s;
	}

	.audiobook-row:last-child {
		border-bottom: none;
	}

	.audiobook-row:hover {
		background-color: var(--bg-hover);
	}

	.audiobook-row-cover {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: cover;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.audiobook-row-cover-placeholder {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.25rem;
		background-color: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.audiobook-row-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
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

	.narrator-tag {
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

	.narrator-tag:hover {
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
