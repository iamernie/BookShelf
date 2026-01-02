<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { goto } from '$app/navigation';
	import {
		User,
		BookOpen,
		Globe,
		Calendar,
		MapPin,
		Edit2,
		Trash2,
		ExternalLink,
		Search,
		Download,
		Star,
		BarChart3,
		X,
		Loader2,
		Library
	} from 'lucide-svelte';
	import type { Author } from '$lib/server/db/schema';
	import { toasts } from '$lib/stores/toast';
	import { formatDate, toInputDate } from '$lib/utils/date';

	interface WikiSearchResult {
		title: string;
		snippet: string;
		pageId: number;
		source: 'wikipedia' | 'fandom';
		preview?: {
			name: string;
			bio: string | null;
			photoUrl: string | null;
			wikipediaUrl: string;
			birthDate: string | null;
			deathDate: string | null;
			birthPlace: string | null;
			website: string | null;
		} | null;
	}

	let {
		author,
		books = [],
		series = [],
		mode = 'view',
		onClose,
		onSave,
		onDelete
	}: {
		author:
			| (Author & {
					readCount?: number;
					averageRating?: number | null;
					completionPercentage?: number;
					bookCount?: number;
			  })
			| null;
		books?: { id: number; title: string; coverImageUrl: string | null }[];
		series?: { id: number; title: string; bookCount: number }[];
		mode: 'view' | 'edit' | 'add';
		onClose: () => void;
		onSave: (data: Partial<Author>) => Promise<void>;
		onDelete?: () => Promise<void>;
	} = $props();

	let currentMode = $state(mode);
	let saving = $state(false);
	let deleting = $state(false);

	// Wikipedia search state
	let showWikiSearch = $state(false);
	let wikiSearching = $state(false);
	let wikiResults = $state<WikiSearchResult[]>([]);
	let wikiError = $state<string | null>(null);
	let selectedResult = $state<WikiSearchResult | null>(null);
	let importing = $state(false);
	let searchSource = $state<'all' | 'wikipedia' | 'fandom'>('all');

	// Form fields
	let name = $state(author?.name || '');
	let bio = $state(author?.bio || '');
	let birthDate = $state(toInputDate(author?.birthDate));
	let deathDate = $state(toInputDate(author?.deathDate));
	let birthPlace = $state(author?.birthPlace || '');
	let photoUrl = $state(author?.photoUrl || '');
	let website = $state(author?.website || '');
	let wikipediaUrl = $state(author?.wikipediaUrl || '');
	let comments = $state(author?.comments || '');

	async function handleSave() {
		if (!name.trim()) return;
		saving = true;
		try {
			await onSave({
				name: name.trim(),
				bio: bio.trim() || null,
				birthDate: birthDate || null,
				deathDate: deathDate || null,
				birthPlace: birthPlace.trim() || null,
				photoUrl: photoUrl.trim() || null,
				website: website.trim() || null,
				wikipediaUrl: wikipediaUrl.trim() || null,
				comments: comments.trim() || null
			});
			onClose();
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!onDelete || !confirm('Are you sure you want to delete this author?')) return;
		deleting = true;
		try {
			await onDelete();
			onClose();
		} finally {
			deleting = false;
		}
	}

	async function searchWikipedia() {
		if (!name.trim()) {
			toasts.warning('Enter an author name first');
			return;
		}

		wikiSearching = true;
		wikiError = null;
		wikiResults = [];
		selectedResult = null;

		try {
			const res = await fetch(
				`/api/authors/wikipedia?name=${encodeURIComponent(name.trim())}&source=${searchSource}`
			);
			const data = await res.json();

			if (data.success && data.results?.length > 0) {
				wikiResults = data.results;
				showWikiSearch = true;
			} else {
				wikiError = data.error || 'No results found';
				showWikiSearch = true;
			}
		} catch (e) {
			wikiError = 'Failed to search';
			showWikiSearch = true;
		} finally {
			wikiSearching = false;
		}
	}

	function selectResult(result: WikiSearchResult) {
		selectedResult = result;
	}

	async function importWikipediaData() {
		if (!selectedResult?.preview) return;

		const preview = selectedResult.preview;
		importing = true;

		try {
			// If author exists, import via API
			if (author?.id) {
				const res = await fetch(`/api/authors/${author.id}/wikipedia`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						bio: preview.bio,
						birthDate: preview.birthDate,
						deathDate: preview.deathDate,
						birthPlace: preview.birthPlace,
						photoUrl: preview.photoUrl,
						website: preview.website,
						wikipediaUrl: preview.wikipediaUrl
					})
				});

				if (res.ok) {
					// Update local form fields
					if (preview.bio) bio = preview.bio;
					if (preview.birthDate) birthDate = preview.birthDate;
					if (preview.deathDate) deathDate = preview.deathDate;
					if (preview.birthPlace) birthPlace = preview.birthPlace;
					if (preview.photoUrl) photoUrl = preview.photoUrl;
					if (preview.website) website = preview.website;
					if (preview.wikipediaUrl) wikipediaUrl = preview.wikipediaUrl;

					toasts.success('Data imported successfully');
					showWikiSearch = false;
				} else {
					toasts.error('Failed to import data');
				}
			} else {
				// Just update form fields for new author
				if (preview.bio) bio = preview.bio;
				if (preview.birthDate) birthDate = preview.birthDate;
				if (preview.deathDate) deathDate = preview.deathDate;
				if (preview.birthPlace) birthPlace = preview.birthPlace;
				if (preview.photoUrl) photoUrl = preview.photoUrl;
				if (preview.website) website = preview.website;
				if (preview.wikipediaUrl) wikipediaUrl = preview.wikipediaUrl;

				toasts.success('Data imported to form');
				showWikiSearch = false;
			}
		} finally {
			importing = false;
		}
	}

	function formatRating(rating: number | null | undefined): string {
		if (rating === null || rating === undefined) return 'N/A';
		return rating.toFixed(1);
	}

	function goToSeries(seriesId: number) {
		onClose();
		goto(`/series?open=${seriesId}`);
	}
</script>

<Modal
	open={true}
	onClose={onClose}
	title={currentMode === 'add' ? 'Add Author' : author?.name || 'Author'}
	size="lg"
>
	{#if currentMode === 'view' && author}
		<!-- View Mode -->
		<div class="modal-content">
			<!-- Header with photo and stats -->
			<div class="author-header">
				<div class="author-photo-wrapper">
					{#if author.photoUrl}
						<img
							src={author.photoUrl}
							alt={author.name}
							class="author-photo"
							onerror={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
						/>
					{:else}
						<img src="/placeholder.png" alt={author.name} class="author-photo placeholder" />
					{/if}
				</div>

				<div class="author-stats">
					<div class="stat-card">
						<BookOpen class="w-5 h-5" />
						<div class="stat-value">{author.bookCount ?? 0}</div>
						<div class="stat-label">Books</div>
					</div>
					<div class="stat-card">
						<BarChart3 class="w-5 h-5" />
						<div class="stat-value">{author.completionPercentage ?? 0}%</div>
						<div class="stat-label">Read</div>
					</div>
					<div class="stat-card">
						<Star class="w-5 h-5" />
						<div class="stat-value">{formatRating(author.averageRating)}</div>
						<div class="stat-label">Rating</div>
					</div>
				</div>
			</div>

			<!-- Author details -->
			<div class="author-details">
				{#if author.birthDate || author.deathDate || author.birthPlace}
					<div class="detail-section">
						{#if author.birthDate || author.deathDate}
							<div class="detail-item">
								<Calendar class="w-4 h-4" />
								<span>
									{formatDate(author.birthDate)}{author.deathDate
										? ` – ${formatDate(author.deathDate)}`
										: ''}
								</span>
							</div>
						{/if}
						{#if author.birthPlace}
							<div class="detail-item">
								<MapPin class="w-4 h-4" />
								<span>{author.birthPlace}</span>
							</div>
						{/if}
					</div>
				{/if}

				{#if author.website || author.wikipediaUrl}
					<div class="detail-section links">
						{#if author.website}
							<a href={author.website} target="_blank" rel="noopener" class="link-item">
								<Globe class="w-4 h-4" />
								<span>Website</span>
								<ExternalLink class="w-3 h-3" />
							</a>
						{/if}
						{#if author.wikipediaUrl}
							<a href={author.wikipediaUrl} target="_blank" rel="noopener" class="link-item">
								<Globe class="w-4 h-4" />
								<span>Wikipedia</span>
								<ExternalLink class="w-3 h-3" />
							</a>
						{/if}
					</div>
				{/if}
			</div>

			{#if author.bio}
				<div class="bio-section">
					<h3 class="section-title">Biography</h3>
					<p class="bio-text">{author.bio}</p>
				</div>
			{/if}

			{#if author.comments}
				<div class="notes-section">
					<h3 class="section-title">Notes</h3>
					<p class="notes-text">{author.comments}</p>
				</div>
			{/if}

			{#if books.length > 0}
				<div class="books-section">
					<h3 class="section-title">
						<BookOpen class="w-4 h-4" />
						Books ({books.length})
					</h3>
					<div class="books-grid">
						{#each books as book}
							<a href="/books/{book.id}" class="book-cover-link">
								<img
									src={book.coverImageUrl || '/placeholder.png'}
									alt={book.title}
									class="book-cover"
									onerror={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
								/>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			{#if series.length > 0}
				<div class="series-section">
					<h3 class="section-title">
						<Library class="w-4 h-4" />
						Series ({series.length})
					</h3>
					<div class="series-list">
						{#each series as s}
							<button type="button" class="series-item" onclick={() => goToSeries(s.id)}>
								<span class="series-name">{s.title}</span>
								<span class="series-count">{s.bookCount} {s.bookCount === 1 ? 'book' : 'books'}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Action buttons -->
			<div class="modal-actions">
				<button type="button" class="btn-danger" onclick={handleDelete} disabled={deleting}>
					<Trash2 class="w-4 h-4" />
					Delete
				</button>
				<button type="button" class="btn-primary" onclick={() => (currentMode = 'edit')}>
					<Edit2 class="w-4 h-4" />
					Edit
				</button>
			</div>
		</div>
	{:else}
		<!-- Edit/Add Mode -->
		<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="modal-content">
			<!-- Wikipedia/Fandom Search -->
			<div class="search-section">
				<div class="search-header">
					<span class="search-label">Import from:</span>
					<div class="search-sources">
						<button
							type="button"
							class="source-btn"
							class:active={searchSource === 'all'}
							onclick={() => (searchSource = 'all')}
						>
							All
						</button>
						<button
							type="button"
							class="source-btn"
							class:active={searchSource === 'wikipedia'}
							onclick={() => (searchSource = 'wikipedia')}
						>
							Wikipedia
						</button>
						<button
							type="button"
							class="source-btn"
							class:active={searchSource === 'fandom'}
							onclick={() => (searchSource = 'fandom')}
						>
							Fandom
						</button>
					</div>
					<button
						type="button"
						class="btn-search"
						onclick={searchWikipedia}
						disabled={wikiSearching || !name.trim()}
					>
						{#if wikiSearching}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							<Search class="w-4 h-4" />
						{/if}
						Search
					</button>
				</div>

				<!-- Search Results -->
				{#if showWikiSearch}
					<div class="search-results">
						<div class="results-header">
							<span class="results-title">Search Results</span>
							<button
								type="button"
								class="close-results"
								onclick={() => (showWikiSearch = false)}
							>
								<X class="w-4 h-4" />
							</button>
						</div>

						{#if wikiError}
							<p class="no-results">{wikiError}</p>
						{:else if wikiResults.length > 0}
							<div class="results-list">
								{#each wikiResults as result}
									<button
										type="button"
										class="result-item"
										class:selected={selectedResult?.pageId === result.pageId}
										onclick={() => selectResult(result)}
									>
										<div class="result-image">
											{#if result.preview?.photoUrl}
												<img src={result.preview.photoUrl} alt="" />
											{:else}
												<User class="w-6 h-6" />
											{/if}
										</div>
										<div class="result-info">
											<div class="result-title">
												<span>{result.title}</span>
												<span
													class="source-badge"
													class:wikipedia={result.source === 'wikipedia'}
													class:fandom={result.source === 'fandom'}
												>
													{result.source}
												</span>
											</div>
											{#if result.preview?.birthDate}
												<p class="result-meta">Born: {formatDate(result.preview.birthDate)}</p>
											{/if}
											{#if result.preview?.bio}
												<p class="result-bio">{result.preview.bio.substring(0, 120)}...</p>
											{/if}
										</div>
									</button>
								{/each}
							</div>

							{#if selectedResult?.preview}
								<button
									type="button"
									class="btn-import"
									onclick={importWikipediaData}
									disabled={importing}
								>
									{#if importing}
										<Loader2 class="w-4 h-4 animate-spin" />
										Importing...
									{:else}
										<Download class="w-4 h-4" />
										Import Selected
									{/if}
								</button>
							{/if}
						{:else}
							<p class="no-results">No results found</p>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Form Fields -->
			<div class="form-grid">
				<div class="form-group full-width">
					<label for="name">Name *</label>
					<input id="name" type="text" bind:value={name} required class="input" />
				</div>

				<div class="form-group full-width">
					<label for="bio">Biography</label>
					<textarea id="bio" bind:value={bio} rows="4" class="input"></textarea>
				</div>

				<div class="form-group">
					<label for="birthDate">Birth Date</label>
					<input id="birthDate" type="date" bind:value={birthDate} class="input" />
				</div>

				<div class="form-group">
					<label for="deathDate">Death Date</label>
					<input id="deathDate" type="date" bind:value={deathDate} class="input" />
				</div>

				<div class="form-group full-width">
					<label for="birthPlace">Birth Place</label>
					<input id="birthPlace" type="text" bind:value={birthPlace} class="input" />
				</div>

				<div class="form-group full-width">
					<label for="photoUrl">Photo URL</label>
					<input id="photoUrl" type="url" bind:value={photoUrl} class="input" />
				</div>

				<div class="form-group">
					<label for="website">Website</label>
					<input id="website" type="url" bind:value={website} class="input" />
				</div>

				<div class="form-group">
					<label for="wikipediaUrl">Wikipedia URL</label>
					<input id="wikipediaUrl" type="url" bind:value={wikipediaUrl} class="input" />
				</div>

				<div class="form-group full-width">
					<label for="comments">Notes</label>
					<textarea id="comments" bind:value={comments} rows="3" class="input"></textarea>
				</div>
			</div>

			<!-- Form Actions -->
			<div class="modal-actions">
				<button
					type="button"
					class="btn-secondary"
					onclick={() => (currentMode === 'add' ? onClose() : (currentMode = 'view'))}
				>
					Cancel
				</button>
				<button type="submit" class="btn-primary" disabled={saving || !name.trim()}>
					{#if saving}
						<Loader2 class="w-4 h-4 animate-spin" />
					{/if}
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</form>
	{/if}
</Modal>

<style>
	.modal-content {
		padding: 1.5rem;
	}

	/* View Mode Styles */
	.author-header {
		display: flex;
		gap: 1.5rem;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.author-photo-wrapper {
		flex-shrink: 0;
	}

	.author-photo {
		width: 100px;
		height: 100px;
		border-radius: 0.75rem;
		object-fit: cover;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.author-photo.placeholder {
		opacity: 0.6;
	}

	.author-photo-placeholder {
		width: 100px;
		height: 100px;
		border-radius: 0.75rem;
		background-color: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.author-stats {
		display: flex;
		gap: 1rem;
		flex: 1;
	}

	.stat-card {
		flex: 1;
		padding: 0.75rem;
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		text-align: center;
		color: var(--text-muted);
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0.25rem 0;
	}

	.stat-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.author-details {
		margin-bottom: 1rem;
	}

	.detail-section {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.detail-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.detail-section.links {
		gap: 1.5rem;
	}

	.link-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--accent);
		text-decoration: none;
	}

	.link-item:hover {
		text-decoration: underline;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.bio-section,
	.notes-section {
		margin-bottom: 1rem;
		padding: 1rem;
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
	}

	.bio-text,
	.notes-text {
		font-size: 0.875rem;
		color: var(--text-primary);
		white-space: pre-wrap;
		line-height: 1.6;
	}

	.books-section {
		margin-bottom: 1rem;
	}

	.books-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
		gap: 0.5rem;
	}

	.book-cover-link {
		display: block;
	}

	.book-cover {
		width: 100%;
		aspect-ratio: 2/3;
		object-fit: cover;
		border-radius: 0.25rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
		transition: transform 0.2s;
	}

	.book-cover:hover {
		transform: scale(1.05);
	}

	.series-section {
		margin-bottom: 1rem;
	}

	.series-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.series-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.625rem 0.875rem;
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		text-decoration: none;
		transition: all 0.2s;
	}

	.series-item:hover {
		border-color: var(--accent);
		background-color: var(--bg-hover);
	}

	.series-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.series-count {
		font-size: 0.75rem;
		color: var(--text-muted);
		background-color: var(--bg-tertiary);
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}

	/* Form Mode Styles */
	.search-section {
		margin-bottom: 1.5rem;
		padding: 1rem;
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
	}

	.search-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.search-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.search-sources {
		display: flex;
		gap: 0.25rem;
	}

	.source-btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.8rem;
		border-radius: 0.375rem;
		border: 1px solid var(--border-color);
		background-color: var(--bg-primary);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s;
	}

	.source-btn:hover {
		background-color: var(--bg-hover);
	}

	.source-btn.active {
		background-color: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	.btn-search {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		border-radius: 0.5rem;
		background-color: var(--accent);
		color: white;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
		margin-left: auto;
	}

	.btn-search:hover:not(:disabled) {
		background-color: var(--accent-hover);
	}

	.btn-search:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.search-results {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.results-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.close-results {
		padding: 0.25rem;
		border-radius: 0.25rem;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
	}

	.close-results:hover {
		background-color: var(--bg-hover);
	}

	.results-list {
		max-height: 300px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.result-item {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border-color);
		background-color: var(--bg-primary);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: all 0.2s;
	}

	.result-item:hover {
		border-color: var(--accent);
	}

	.result-item.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-muted);
	}

	.result-image {
		width: 48px;
		height: 48px;
		border-radius: 0.375rem;
		background-color: var(--bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
		color: var(--text-muted);
	}

	.result-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.result-info {
		flex: 1;
		min-width: 0;
	}

	.result-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.source-badge {
		font-size: 0.65rem;
		padding: 0.125rem 0.375rem;
		border-radius: 9999px;
		text-transform: uppercase;
		font-weight: 600;
	}

	.source-badge.wikipedia {
		background-color: #e8f4ea;
		color: #1a7f37;
	}

	.source-badge.fandom {
		background-color: #fef3e2;
		color: #c4720c;
	}

	:global(.dark) .source-badge.wikipedia {
		background-color: rgba(26, 127, 55, 0.2);
	}

	:global(.dark) .source-badge.fandom {
		background-color: rgba(196, 114, 12, 0.2);
	}

	.result-meta {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.125rem;
	}

	.result-bio {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-top: 0.25rem;
		line-height: 1.4;
	}

	.btn-import {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem;
		margin-top: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.5rem;
		background-color: var(--accent);
		color: white;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-import:hover:not(:disabled) {
		background-color: var(--accent-hover);
	}

	.btn-import:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.no-results {
		font-size: 0.875rem;
		color: var(--text-muted);
		text-align: center;
		padding: 1rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	.form-group label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-muted);
	}

	textarea.input {
		resize: vertical;
		min-height: 80px;
	}

	/* Action Buttons */
	.modal-actions {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 1rem;
		margin-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.btn-primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.5rem;
		background-color: var(--accent);
		color: white;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: var(--accent-hover);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-secondary:hover {
		background-color: var(--bg-hover);
	}

	.btn-danger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.5rem;
		background: none;
		color: var(--error, #ef4444);
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-danger:hover:not(:disabled) {
		background-color: rgba(239, 68, 68, 0.1);
	}

	.btn-danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}

	@media (max-width: 640px) {
		.author-header {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}

		.author-stats {
			width: 100%;
		}

		.search-header {
			flex-direction: column;
			align-items: stretch;
		}

		.btn-search {
			margin-left: 0;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.form-group {
			grid-column: 1;
		}
	}
</style>
