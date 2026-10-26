<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		BookOpen,
		ArrowLeft,
		Edit,
		Trash2,
		Star,
		Hash,
		User,
		Tag,
		Download,
		ExternalLink,
		FileText,
		Pencil,
		Check,
		Info,
		Sparkles,
		Calendar,
		BookMarked,
		Globe,
		Library,
		Headphones,
		Music,
		HardDrive,
		Upload,
		Wand2,
		Loader2,
		BookPlus,
		AlertTriangle,
		ExternalLink as LinkIcon
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import { formatDate } from '$lib/utils/date';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';
	import InlineTagEditor from '$lib/components/tag/InlineTagEditor.svelte';
	import MetadataSearchModal from '$lib/components/book/MetadataSearchModal.svelte';
	import AbsLinkSection from '$lib/components/audiobook/AbsLinkSection.svelte';
	import { RefreshCw } from 'lucide-svelte';

	import { browser } from '$app/environment';

	let { data } = $props();

	// Store the referrer URL for back navigation
	// Only store if coming from a different page (not from edit)
	let returnUrl = $state<string | null>(null);
	let returnUrlInitialized = false;

	$effect(() => {
		if (browser && !returnUrlInitialized) {
			returnUrlInitialized = true;
			const storageKey = `book-return-${data.book.id}`;
			const stored = sessionStorage.getItem(storageKey);
			if (stored) {
				returnUrl = stored;
			} else {
				// Get referrer and store it if it's not the edit page
				const ref = document.referrer;
				if (ref && !ref.includes(`/books/${data.book.id}/edit`)) {
					try {
						const refUrl = new URL(ref);
						// Only store if from same origin and not the current book page
						if (refUrl.origin === window.location.origin && !refUrl.pathname.endsWith(`/books/${data.book.id}`)) {
							returnUrl = refUrl.pathname + refUrl.search;
							sessionStorage.setItem(storageKey, returnUrl);
						}
					} catch {
						// Invalid URL, ignore
					}
				}
			}
		}
	});

	// Tab state
	let activeTab = $state<'details' | 'media' | 'similar'>('details');

	// Check if there's an ebook attached
	const hasEbook = $derived(!!data.book.ebookPath);
	const mediaCount = $derived((hasEbook ? 1 : 0) + (data.book.absItemId ? 1 : 0));

	// Audiobookshelf manual linking (admins, integration enabled)
	const canLinkAbs = $derived(!!data.absBaseUrl && data.isAdmin);

	// Parse ebook reading progress
	interface ReadingProgress {
		location: string;
		percentage: number;
		chapter?: string;
		savedAt?: string;
		source?: string;
	}

	const ebookProgress = $derived.by(() => {
		if (!data.book.readingProgress) return null;
		try {
			return JSON.parse(data.book.readingProgress) as ReadingProgress;
		} catch {
			return null;
		}
	});

	// Format relative time (e.g., "2 hours ago", "3 days ago")
	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return formatDate(dateStr);
	}

	let showDeleteConfirm = $state(false);
	let permanentDelete = $state(false);

	// Metadata update state
	let showMetadataModal = $state(false);
	let updatingMetadata = $state(false);

	// Inline rating/status state
	let currentRating = $state(data.book.rating ?? 0);
	let currentStatusId = $state(data.book.statusId);
	let savingRating = $state(false);
	let savingStatus = $state(false);
	let hoverRating = $state(0);

	// Track book ID to detect navigation between books
	let lastBookId = $state(data.book.id);

	// Reset local state when navigating to a different book
	$effect(() => {
		if (data.book.id !== lastBookId) {
			lastBookId = data.book.id;
			// Reset all book-specific local state
			currentRating = data.book.rating ?? 0;
			currentStatusId = data.book.statusId;
			hoverRating = 0;
			activeTab = 'details';
			editingSummary = false;
			editingNotes = false;
			editingSeriesNotes = null;
			showMetadataModal = false;
			returnUrlInitialized = false;
			returnUrl = null;
		}
	});

	// Update rating function
	async function updateRating(newRating: number) {
		// Allow clicking same star to remove rating
		const ratingToSave = newRating === currentRating ? null : newRating;
		savingRating = true;
		try {
			const res = await fetch(`/api/books/${data.book.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rating: ratingToSave })
			});
			if (res.ok) {
				currentRating = ratingToSave ?? 0;
				toasts.success(ratingToSave ? `Rated ${ratingToSave} star${ratingToSave > 1 ? 's' : ''}` : 'Rating cleared');
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to update rating');
			}
		} finally {
			savingRating = false;
		}
	}

	// Update status function
	async function updateStatus(newStatusId: number | null) {
		savingStatus = true;
		try {
			const res = await fetch(`/api/books/${data.book.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ statusId: newStatusId })
			});
			if (res.ok) {
				currentStatusId = newStatusId;
				toasts.success('Status updated');
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to update status');
			}
		} finally {
			savingStatus = false;
		}
	}

	// Derived: is this a public library book?
	const isPublicLibraryBook = $derived(data.book.libraryType === 'public');

	// Inline editing state
	let editingSummary = $state(false);
	let editingNotes = $state(false);
	let editingSeriesNotes = $state<number | null>(null); // series ID being edited
	let savingSummary = $state(false);
	let savingNotes = $state(false);
	let savingSeriesNotes = $state(false);

	// Local editable copies
	let editSummaryValue = $state('');
	let editNotesValue = $state('');
	let editSeriesNotesValue = $state('');

	// AI Recommendations state
	interface AIRecommendation {
		title: string;
		author: string;
		reason: string;
		inLibrary?: boolean;
		bookId?: number;
	}
	let aiRecommendations = $state<AIRecommendation[]>([]);
	let loadingAI = $state(false);
	let aiError = $state<string | null>(null);
	let addingToLibrary = $state<string | null>(null); // title of book being added

	async function getAIRecommendations() {
		loadingAI = true;
		aiError = null;
		aiRecommendations = [];

		try {
			const res = await fetch(`/api/books/${data.book.id}/ai-recommendations`);
			const result = await res.json();

			if (result.success) {
				aiRecommendations = result.recommendations;
			} else {
				aiError = result.error || 'Failed to get recommendations';
			}
		} catch (err) {
			aiError = 'Failed to connect to AI service';
		} finally {
			loadingAI = false;
		}
	}

	async function addToWishlist(rec: AIRecommendation) {
		addingToLibrary = rec.title;
		try {
			const res = await fetch(`/api/books/${data.book.id}/ai-recommendations`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: rec.title, author: rec.author })
			});
			const result = await res.json();

			if (result.success) {
				toasts.success(`"${rec.title}" added to wishlist`);
				// Update the recommendation to show it's now in library
				aiRecommendations = aiRecommendations.map(r =>
					r.title === rec.title ? { ...r, inLibrary: true, bookId: result.bookId } : r
				);
			} else if (result.bookId) {
				// Already exists
				toasts.info(`"${rec.title}" is already in your library`);
				aiRecommendations = aiRecommendations.map(r =>
					r.title === rec.title ? { ...r, inLibrary: true, bookId: result.bookId } : r
				);
			} else {
				toasts.error(result.error || 'Failed to add book');
			}
		} catch (err) {
			toasts.error('Failed to add book to library');
		} finally {
			addingToLibrary = null;
		}
	}

	// Initialize edit values when editing starts
	function startEditSummary() {
		editSummaryValue = data.book.summary || '';
		editingSummary = true;
	}

	function startEditNotes() {
		editNotesValue = data.book.comments || '';
		editingNotes = true;
	}

	function startEditSeriesNotes(seriesId: number, currentNotes: string | null) {
		editSeriesNotesValue = currentNotes || '';
		editingSeriesNotes = seriesId;
	}

	async function saveSummary() {
		savingSummary = true;
		try {
			const res = await fetch(`/api/books/${data.book.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ summary: editSummaryValue })
			});
			if (res.ok) {
				toasts.success('Summary saved');
				editingSummary = false;
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save summary');
			}
		} finally {
			savingSummary = false;
		}
	}

	async function saveNotes() {
		savingNotes = true;
		try {
			const res = await fetch(`/api/books/${data.book.id}`, {
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

	function cancelSummaryEdit() {
		editingSummary = false;
	}

	function cancelNotesEdit() {
		editingNotes = false;
	}

	async function saveSeriesNotes() {
		if (editingSeriesNotes === null) return;
		savingSeriesNotes = true;
		try {
			const res = await fetch(`/api/series/${editingSeriesNotes}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ comments: editSeriesNotesValue })
			});
			if (res.ok) {
				toasts.success('Series notes saved');
				editingSeriesNotes = null;
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save series notes');
			}
		} finally {
			savingSeriesNotes = false;
		}
	}

	function cancelSeriesNotesEdit() {
		editingSeriesNotes = null;
	}

	async function handleDelete() {
		// For public library books, admin can choose to permanently delete
		const url = permanentDelete
			? `/api/books/${data.book.id}?permanent=true`
			: `/api/books/${data.book.id}`;

		const res = await fetch(url, {
			method: 'DELETE'
		});
		if (res.ok) {
			const result = await res.json();
			if (result.action === 'removed_from_library') {
				toasts.success('Removed from your library');
			} else {
				toasts.success('Book deleted');
			}
			goto('/books');
		} else {
			const err = await res.json();
			toasts.error(err.message || 'Failed to delete book');
		}
	}


	function formatSeriesNumber(s: { bookNum: number | null; bookNumEnd: number | null }): string {
		if (!s.bookNum) return '';
		if (s.bookNumEnd) return `#${s.bookNum}-${s.bookNumEnd}`;
		return `#${s.bookNum}`;
	}

	// Apply metadata from search modal
	async function applyMetadataResult(result: any, selectedFields: string[]) {
		updatingMetadata = true;
		try {
			const updates: Record<string, any> = {};
			let coverDownloaded = false;

			for (const field of selectedFields) {
				switch (field) {
					case 'title':
						if (result.title) updates.title = result.title;
						break;
					case 'summary':
						if (result.description) updates.summary = result.description;
						break;
					case 'coverUrl':
						// Download the cover image - try coverUrl first, then thumbnailUrl as fallback
						const urlsToTry = [result.coverUrl, result.thumbnailUrl].filter(Boolean);
						for (const imageUrl of urlsToTry) {
							if (coverDownloaded) break;
							updates.originalCoverUrl = imageUrl;
							try {
								const res = await fetch('/api/covers/download', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ url: imageUrl, bookId: data.book.id })
								});
								if (res.ok) {
									const coverData = await res.json();
									updates.coverImageUrl = coverData.coverPath;
									coverDownloaded = true;
								}
							} catch {
								// Try next URL
							}
						}
						break;
					case 'isbn13':
						if (result.isbn13) updates.isbn13 = result.isbn13;
						break;
					case 'isbn10':
						if (result.isbn10) updates.isbn10 = result.isbn10;
						break;
					case 'publisher':
						if (result.publisher) updates.publisher = result.publisher;
						break;
					case 'publishYear':
						if (result.publishYear) updates.publishYear = result.publishYear;
						break;
					case 'pageCount':
						if (result.pageCount) updates.pageCount = result.pageCount;
						break;
					case 'language':
						if (result.language) updates.language = result.language;
						break;
					case 'rating':
						// Store as provider rating, not user rating
						if (result.rating) {
							updates.providerRating = result.rating;
							updates.providerRatingSource = result.provider;
							if (result.ratingCount) {
								updates.providerRatingCount = result.ratingCount;
							}
						}
						break;
				}
			}

			// Store provider IDs
			if (result.provider === 'goodreads' && result.providerId) {
				updates.goodreadsId = result.providerId;
			} else if (result.provider === 'googlebooks' && result.providerId) {
				updates.googleBooksId = result.providerId;
			}

			// Only save if we have updates
			if (Object.keys(updates).length > 0) {
				const res = await fetch(`/api/books/${data.book.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(updates)
				});
				if (res.ok) {
					const coverMsg = coverDownloaded ? ' (cover downloaded)' : '';
					toasts.success(`Updated ${selectedFields.length} fields from ${result.provider}${coverMsg}`);
					showMetadataModal = false;
					invalidateAll();
				} else {
					const err = await res.json();
					toasts.error(err.message || 'Failed to update metadata');
				}
			}
		} catch (err) {
			toasts.error('Failed to apply metadata');
		} finally {
			updatingMetadata = false;
		}
	}
</script>

<svelte:head>
	<title>{data.book.title} - BookShelf</title>
</svelte:head>

<div class="min-h-full" style="background-color: var(--bg-primary);">
	<!-- Header -->
	<div class="sticky top-0 z-10 px-3 sm:px-6 py-3 sm:py-4" style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
		<div class="max-w-6xl mx-auto flex items-center justify-between gap-2">
			<button
				type="button"
				class="flex items-center gap-1 sm:gap-2 transition-colors flex-shrink-0"
				style="color: var(--text-secondary);"
				onclick={() => {
					// Clear the stored return URL when leaving
					if (browser) sessionStorage.removeItem(`book-return-${data.book.id}`);
					if (returnUrl) {
						goto(returnUrl);
					} else {
						// Fall back to books list instead of history.back()
						// which can be unreliable after page interactions
						goto('/books');
					}
				}}
				onmouseenter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
				onmouseleave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
			>
				<ArrowLeft class="w-5 h-5" />
				<span class="hidden sm:inline">Back</span>
			</button>

			<div class="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
				{#if data.book.ebookPath}
					{#if data.ebookMissing}
						<span
							class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm rounded-lg"
							style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"
							title="Ebook file not found on server"
						>
							<AlertTriangle class="w-4 h-4" />
							<span class="hidden xs:inline">Ebook Missing</span>
						</span>
					{:else}
						<a
							href="/reader/{data.book.id}"
							class="btn-accent flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm"
						>
							<BookOpen class="w-4 h-4" />
							<span class="hidden xs:inline">Read</span>
						</a>
					{/if}
				{/if}
				{#if data.book.absItemId && data.absBaseUrl}
					<a
						href="{data.absBaseUrl}/item/{data.book.absItemId}"
						target="_blank"
						rel="noopener noreferrer"
						class="btn-accent flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm"
						title="Listen on Audiobookshelf"
					>
						<Headphones class="w-4 h-4" />
						<span class="hidden xs:inline">Listen on Audiobookshelf</span>
						<ExternalLink class="w-3 h-3" />
					</a>
				{/if}
				<button
					type="button"
					class="btn-ghost flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm"
					onclick={() => showMetadataModal = true}
					disabled={updatingMetadata}
					title="Lookup metadata from online sources"
				>
					{#if updatingMetadata}
						<Loader2 class="w-4 h-4 animate-spin" />
					{:else}
						<RefreshCw class="w-4 h-4" />
					{/if}
					<span class="hidden sm:inline">Lookup</span>
				</button>
				<a
					href="/books/{data.book.id}/edit"
					class="btn-ghost flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm"
				>
					<Edit class="w-4 h-4" />
					<span class="hidden sm:inline">Edit</span>
				</a>
				<button
					type="button"
					class="btn-ghost flex items-center gap-2 px-2 py-1.5"
					style="color: var(--text-muted);"
					onclick={() => showDeleteConfirm = true}
				>
					<Trash2 class="w-4 h-4" />
				</button>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-6xl mx-auto px-4 py-4">
		<!-- Missing Files Warning Banner -->
		{#if data.ebookMissing}
			<div
				class="mb-4 p-4 rounded-lg flex items-start gap-3"
				style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);"
			>
				<AlertTriangle class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: #ef4444;" />
				<div>
					<p class="font-medium" style="color: #ef4444;">Missing Media Files</p>
					<p class="text-sm mt-1" style="color: var(--text-muted);">
						The ebook file for this book could not be found on the server. It may need to be re-uploaded.
					</p>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<!-- Left Column: Cover + Quick Info -->
			<div class="lg:col-span-1">
				<!-- Cover with blurred background -->
				<div class="relative aspect-[2/3] rounded-lg overflow-hidden shadow-lg mb-3" style="background-color: var(--bg-tertiary);">
					<!-- Blurred background image -->
					{#if data.book.coverImageUrl}
						<img
							src={data.book.coverImageUrl}
							alt=""
							class="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60"
							aria-hidden="true"
						/>
					{/if}
					<!-- Main cover image (contained) -->
					<img
						src={data.book.coverImageUrl || '/placeholder.png'}
						alt={data.book.title}
						class="relative w-full h-full object-contain drop-shadow-lg"
						onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
					/>

					<!-- Series Badge -->
					{#if data.book.series[0]?.bookNum}
						<div class="absolute top-2 left-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs font-medium">
							{formatSeriesNumber(data.book.series[0])}
						</div>
					{/if}
				</div>

				<!-- Inline Rating -->
				<div class="mb-3">
					<div
						class="flex items-center justify-center gap-0.5 py-1.5"
						role="group"
						aria-label="Rate this book"
					>
						{#each [1, 2, 3, 4, 5] as star}
							<button
								type="button"
								class="rating-star p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
								onclick={() => updateRating(star)}
								onmouseenter={() => hoverRating = star}
								onmouseleave={() => hoverRating = 0}
								disabled={savingRating}
								title={star === currentRating ? 'Click to remove rating' : `Rate ${star} star${star > 1 ? 's' : ''}`}
							>
								<Star
									class="w-6 h-6 transition-colors {(hoverRating >= star || (!hoverRating && currentRating >= star)) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}"
								/>
							</button>
						{/each}
						{#if currentRating > 0}
							<span class="ml-2 text-sm font-medium" style="color: var(--text-secondary);">{currentRating.toFixed(1)}</span>
						{/if}
					</div>
				</div>

				<!-- Inline Status Selector -->
				<div class="mb-3">
					<select
						class="status-select w-full py-2 px-3 rounded-lg text-sm font-medium text-center cursor-pointer transition-all"
						style="background-color: {data.allStatuses.find(s => s.id === currentStatusId)?.color || 'var(--bg-tertiary)'}; color: {currentStatusId ? 'white' : 'var(--text-secondary)'}; border: 1px solid {currentStatusId ? 'transparent' : 'var(--border-color)'};"
						value={currentStatusId ?? ''}
						onchange={(e) => {
							const val = e.currentTarget.value;
							updateStatus(val ? parseInt(val) : null);
						}}
						disabled={savingStatus}
					>
						<option value="">No Status</option>
						{#each data.allStatuses as status}
							<option value={status.id}>{status.name}</option>
						{/each}
					</select>
				</div>

				<!-- Format & Genre Pills -->
				<div class="flex flex-wrap gap-1.5 mb-3">
					{#if data.book.format}
						<span
							class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white"
							style="background-color: {data.book.format.color || '#6c757d'}"
						>
							<LucideIcon name={data.book.format.icon || 'book'} size={12} />
							{data.book.format.name}
						</span>
					{/if}
					{#if data.book.genre}
						<span
							class="px-2 py-1 rounded text-xs"
							style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
						>
							{data.book.genre.name}
						</span>
					{/if}
				</div>

				<!-- Quick Actions -->
				{#if data.book.ebookPath}
					<a
						href="/api/ebooks/{data.book.id}/download"
						class="w-full btn-ghost flex items-center justify-center gap-1.5 py-1.5 text-sm mb-3"
					>
						<Download class="w-3.5 h-3.5" />
						Download
					</a>
				{/if}

				<!-- External Links (inline) -->
				{#if data.book.goodreadsId || data.book.googleBooksId || data.book.asin}
					<div class="flex flex-wrap gap-2 text-xs mb-3">
						{#if data.book.goodreadsId}
							<a
								href="https://www.goodreads.com/book/show/{data.book.goodreadsId}"
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-1 transition-colors hover:underline"
								style="color: var(--accent);"
							>
								<ExternalLink class="w-3 h-3" />
								Goodreads
							</a>
						{/if}
						{#if data.book.googleBooksId}
							<a
								href="https://books.google.com/books?id={data.book.googleBooksId}"
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-1 transition-colors hover:underline"
								style="color: var(--accent);"
							>
								<ExternalLink class="w-3 h-3" />
								Google
							</a>
						{/if}
						{#if data.book.asin}
							<a
								href="https://www.amazon.com/dp/{data.book.asin}"
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-1 transition-colors hover:underline"
								style="color: var(--accent);"
							>
								<ExternalLink class="w-3 h-3" />
								Amazon
							</a>
						{/if}
					</div>
				{/if}

				<!-- Quick Info Card -->
				<div class="card p-3 text-xs space-y-1.5">
					{#if data.book.pageCount}
						<div class="flex justify-between">
							<span style="color: var(--text-muted);">Pages</span>
							<span style="color: var(--text-primary);">{data.book.pageCount}</span>
						</div>
					{/if}
					{#if data.book.releaseDate}
						<div class="flex justify-between">
							<span style="color: var(--text-muted);">Published</span>
							<span style="color: var(--text-primary);">{formatDate(data.book.releaseDate)}</span>
						</div>
					{/if}
					{#if data.book.publisher}
						<div class="flex justify-between">
							<span style="color: var(--text-muted);">Publisher</span>
							<span style="color: var(--text-primary);" class="text-right max-w-[120px] truncate" title={data.book.publisher}>{data.book.publisher}</span>
						</div>
					{/if}
					{#if data.book.isbn13}
						<div class="flex justify-between">
							<span style="color: var(--text-muted);">ISBN</span>
							<span class="font-mono" style="color: var(--text-primary);">{data.book.isbn13}</span>
						</div>
					{:else if data.book.isbn10}
						<div class="flex justify-between">
							<span style="color: var(--text-muted);">ISBN</span>
							<span class="font-mono" style="color: var(--text-primary);">{data.book.isbn10}</span>
						</div>
					{/if}
					{#if data.book.asin}
						<div class="flex justify-between">
							<span style="color: var(--text-muted);">ASIN</span>
							<span class="font-mono" style="color: var(--text-primary);">{data.book.asin}</span>
						</div>
					{/if}
					{#if data.book.createdAt}
						<div class="flex justify-between">
							<span style="color: var(--text-muted);">Added</span>
							<span style="color: var(--text-primary);">{formatDate(data.book.createdAt)}</span>
						</div>
					{/if}
				</div>

				<!-- Provider Rating (from external sources like Goodreads) -->
				{#if data.book.providerRating}
					<div class="card p-3 mt-3">
						<h4 class="text-xs font-semibold mb-2" style="color: var(--text-muted);">Community Rating</h4>
						<div class="flex items-center gap-2">
							<div class="flex items-center gap-0.5">
								{#each [1, 2, 3, 4, 5] as star}
									<Star
										class="w-4 h-4 {data.book.providerRating >= star ? 'fill-yellow-400 text-yellow-400' : data.book.providerRating >= star - 0.5 ? 'fill-yellow-400/50 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}"
									/>
								{/each}
							</div>
							<span class="text-sm font-medium" style="color: var(--text-primary);">
								{data.book.providerRating.toFixed(2)}
							</span>
						</div>
						<div class="flex items-center justify-between mt-1.5 text-xs" style="color: var(--text-muted);">
							<span class="capitalize">{data.book.providerRatingSource || 'External'}</span>
							{#if data.book.providerRatingCount}
								<span>{data.book.providerRatingCount.toLocaleString()} ratings</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Media Sources (where purchased) -->
				{#if data.bookMediaSources && data.bookMediaSources.length > 0}
					<div class="card p-3 mt-3">
						<h4 class="text-xs font-semibold mb-2" style="color: var(--text-muted);">Owned On</h4>
						<div class="flex flex-wrap gap-1.5">
							{#each data.bookMediaSources as bms}
								<span
									class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white"
									style="background-color: {bms.mediaSource.color || '#6c757d'}"
									title={bms.notes || bms.mediaSource.name}
								>
									<LucideIcon name={bms.mediaSource.icon || 'shopping-bag'} size={12} />
									{bms.mediaSource.name}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Right Column: Details -->
			<div class="lg:col-span-3">
				<!-- Title -->
				<h1 class="text-2xl font-bold mb-1" style="color: var(--text-primary);">
					{data.book.title}
				</h1>

				<!-- Authors -->
				{#if data.book.authors.length > 0}
					<div class="flex items-center gap-1.5 mb-2">
						<User class="w-4 h-4" style="color: var(--text-muted);" />
						<div class="flex flex-wrap gap-1">
							{#each data.book.authors as author}
								<a
									href="/authors/{author.id}"
									class="transition-colors"
									style="color: var(--accent);"
								>
									{author.name}
									{#if author.role && author.role !== 'Author'}
										<span class="text-xs" style="color: var(--text-muted);">({author.role})</span>
									{/if}
								</a>
								{#if data.book.authors.indexOf(author) < data.book.authors.length - 1}
									<span style="color: var(--text-muted);">,</span>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				<!-- Series & Narrator Row -->
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-sm">
					{#if data.book.series.length > 0}
						<div class="flex items-center gap-1.5">
							<Hash class="w-4 h-4" style="color: var(--text-muted);" />
							{#each data.book.series as s, i}
								<a
									href="/series/{s.id}"
									class="transition-colors"
									style="color: var(--accent);"
								>
									{s.title} {#if s.bookNum}<span style="color: var(--text-secondary);">{formatSeriesNumber(s)}</span>{/if}
								</a>{#if i < data.book.series.length - 1}<span style="color: var(--text-muted);">,</span>{/if}
							{/each}
						</div>
					{/if}
					{#if data.book.narrator}
						<div class="flex items-center gap-1.5">
							<BookMarked class="w-4 h-4" style="color: var(--text-muted);" />
							<a href="/narrators/{data.book.narrator.id}" style="color: var(--accent);">{data.book.narrator.name}</a>
						</div>
					{/if}
				</div>

				<!-- Reading Dates -->
				{#if data.book.startReadingDate || data.book.completedDate}
					<div class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-sm">
						{#if data.book.startReadingDate}
							<div class="flex items-center gap-1.5">
								<Calendar class="w-4 h-4" style="color: var(--text-muted);" />
								<span style="color: var(--text-secondary);">Started {formatDate(data.book.startReadingDate)}</span>
							</div>
						{/if}
						{#if data.book.completedDate}
							<div class="flex items-center gap-1.5">
								<Check class="w-4 h-4" style="color: var(--text-muted);" />
								<span style="color: var(--text-secondary);">Finished {formatDate(data.book.completedDate)}</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Tags -->
				<div class="flex items-start gap-1.5 mb-4">
					<Tag class="w-4 h-4 mt-1 flex-shrink-0" style="color: var(--text-muted);" />
					<InlineTagEditor
						entityType="book"
						entityId={data.book.id}
						currentTags={data.book.tags}
						allTags={data.allTags}
						onUpdate={() => invalidateAll()}
					/>
				</div>

				<!-- Tab Navigation -->
				<div class="mb-4 border-b" style="border-color: var(--border-color);">
					<div class="flex gap-1">
						<button
							type="button"
							class="tab-btn"
							class:active={activeTab === 'details'}
							onclick={() => activeTab = 'details'}
						>
							<Info class="w-4 h-4" />
							Details
						</button>
						<button
							type="button"
							class="tab-btn"
							class:active={activeTab === 'media'}
							onclick={() => activeTab = 'media'}
						>
							<Music class="w-4 h-4" />
							Media
							{#if mediaCount > 0}
								<span class="ml-1 px-1.5 py-0.5 text-xs rounded-full" style="background: var(--bg-tertiary); color: var(--text-muted);">
									{mediaCount}
								</span>
							{/if}
						</button>
						<button
							type="button"
							class="tab-btn"
							class:active={activeTab === 'similar'}
							onclick={() => activeTab = 'similar'}
						>
							<Sparkles class="w-4 h-4" />
							Similar
						</button>
					</div>
				</div>

				<!-- Tab Content -->
				{#if activeTab === 'details'}
				<!-- Summary Section -->
				{#if data.book.summary || editingSummary}
					<div class="card p-4 mb-4">
						<div class="flex items-center justify-between mb-2">
							<h2 class="text-sm font-semibold" style="color: var(--text-primary);">Summary</h2>
							{#if !editingSummary}
								<button
									type="button"
									class="inline-edit-btn"
									onclick={startEditSummary}
									title="Edit summary"
								>
									<Pencil class="w-3.5 h-3.5" />
								</button>
							{/if}
						</div>
						{#if editingSummary}
							<div class="inline-edit-container">
								<textarea
									class="inline-edit-textarea"
									bind:value={editSummaryValue}
									placeholder="Add a summary..."
									rows="5"
								></textarea>
								<div class="inline-edit-actions">
									<button
										type="button"
										class="inline-save-btn"
										onclick={saveSummary}
										disabled={savingSummary}
									>
										<Check class="w-3.5 h-3.5" />
										{savingSummary ? 'Saving...' : 'Save'}
									</button>
									<button
										type="button"
										class="inline-cancel-btn"
										onclick={cancelSummaryEdit}
										disabled={savingSummary}
									>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<p class="whitespace-pre-wrap leading-relaxed text-sm" style="color: var(--text-secondary);">{data.book.summary}</p>
						{/if}
					</div>
				{/if}

				<!-- Notes Grid - combined in a row -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
					<!-- Personal Notes -->
					<div class="card p-4">
						<div class="flex items-center justify-between mb-2">
							<h2 class="text-sm font-semibold flex items-center gap-1.5" style="color: var(--text-primary);">
								<FileText class="w-4 h-4" />
								Notes
							</h2>
							{#if !editingNotes}
								<button
									type="button"
									class="inline-edit-btn"
									onclick={startEditNotes}
									title="Edit notes"
								>
									<Pencil class="w-3.5 h-3.5" />
								</button>
							{/if}
						</div>
						{#if editingNotes}
							<div class="inline-edit-container">
								<textarea
									class="inline-edit-textarea"
									bind:value={editNotesValue}
									placeholder="Add personal notes..."
									rows="3"
								></textarea>
								<div class="inline-edit-actions">
									<button
										type="button"
										class="inline-save-btn"
										onclick={saveNotes}
										disabled={savingNotes}
									>
										<Check class="w-3.5 h-3.5" />
										{savingNotes ? 'Saving...' : 'Save'}
									</button>
									<button
										type="button"
										class="inline-cancel-btn"
										onclick={cancelNotesEdit}
										disabled={savingNotes}
									>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<button
								type="button"
								class="inline-edit-content text-sm"
								onclick={startEditNotes}
							>
								{#if data.book.comments}
									<p class="whitespace-pre-wrap" style="color: var(--text-secondary);">{data.book.comments}</p>
								{:else}
									<p class="text-placeholder">Click to add notes...</p>
								{/if}
							</button>
						{/if}
					</div>

					<!-- Series Notes (show first series or placeholder) -->
					{#if data.book.series.length > 0}
						{@const s = data.book.series[0]}
						<div class="card p-4">
							<div class="flex items-center justify-between mb-2">
								<h2 class="text-sm font-semibold flex items-center gap-1.5" style="color: var(--text-primary);">
									<Hash class="w-4 h-4" />
									{s.title} Notes
								</h2>
								{#if editingSeriesNotes !== s.id}
									<button
										type="button"
										class="inline-edit-btn"
										onclick={() => startEditSeriesNotes(s.id, s.comments)}
										title="Edit series notes"
									>
										<Pencil class="w-3.5 h-3.5" />
									</button>
								{/if}
							</div>
							{#if editingSeriesNotes === s.id}
								<div class="inline-edit-container">
									<textarea
										class="inline-edit-textarea"
										bind:value={editSeriesNotesValue}
										placeholder="Add notes about this series..."
										rows="3"
									></textarea>
									<div class="inline-edit-actions">
										<button
											type="button"
											class="inline-save-btn"
											onclick={saveSeriesNotes}
											disabled={savingSeriesNotes}
										>
											<Check class="w-3.5 h-3.5" />
											{savingSeriesNotes ? 'Saving...' : 'Save'}
										</button>
										<button
											type="button"
											class="inline-cancel-btn"
											onclick={cancelSeriesNotesEdit}
											disabled={savingSeriesNotes}
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<button
									type="button"
									class="inline-edit-content text-sm"
									onclick={() => startEditSeriesNotes(s.id, s.comments)}
								>
									{#if s.comments}
										<p class="whitespace-pre-wrap" style="color: var(--text-secondary);">{s.comments}</p>
									{:else}
										<p class="text-placeholder">Click to add series notes...</p>
									{/if}
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Additional Series Notes (if more than one series) -->
				{#if data.book.series.length > 1}
					{#each data.book.series.slice(1) as s}
						<div class="card p-4 mb-4">
							<div class="flex items-center justify-between mb-2">
								<h2 class="text-sm font-semibold flex items-center gap-1.5" style="color: var(--text-primary);">
									<Hash class="w-4 h-4" />
									{s.title} Notes
								</h2>
								{#if editingSeriesNotes !== s.id}
									<button
										type="button"
										class="inline-edit-btn"
										onclick={() => startEditSeriesNotes(s.id, s.comments)}
										title="Edit series notes"
									>
										<Pencil class="w-3.5 h-3.5" />
									</button>
								{/if}
							</div>
							{#if editingSeriesNotes === s.id}
								<div class="inline-edit-container">
									<textarea
										class="inline-edit-textarea"
										bind:value={editSeriesNotesValue}
										placeholder="Add notes about this series..."
										rows="3"
									></textarea>
									<div class="inline-edit-actions">
										<button
											type="button"
											class="inline-save-btn"
											onclick={saveSeriesNotes}
											disabled={savingSeriesNotes}
										>
											<Check class="w-3.5 h-3.5" />
											{savingSeriesNotes ? 'Saving...' : 'Save'}
										</button>
										<button
											type="button"
											class="inline-cancel-btn"
											onclick={cancelSeriesNotesEdit}
											disabled={savingSeriesNotes}
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<button
									type="button"
									class="inline-edit-content text-sm"
									onclick={() => startEditSeriesNotes(s.id, s.comments)}
								>
									{#if s.comments}
										<p class="whitespace-pre-wrap" style="color: var(--text-secondary);">{s.comments}</p>
									{:else}
										<p class="text-placeholder">Click to add series notes...</p>
									{/if}
								</button>
							{/if}
						</div>
					{/each}
				{/if}
				{:else if activeTab === 'media'}
				<!-- Media Tab - Ebook -->
				<div class="space-y-4 sm:space-y-6">
					<!-- Ebook Section -->
					<div>
						<h3 class="text-sm font-semibold mb-2 sm:mb-3 flex items-center gap-2" style="color: var(--text-primary);">
							<BookOpen class="w-4 h-4" />
							Ebook
						</h3>
						{#if data.book.ebookPath}
							<div class="card p-3 sm:p-4">
								<div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
									<div class="flex items-center gap-3 flex-1 min-w-0">
										<div class="w-10 h-14 sm:w-12 sm:h-16 flex-shrink-0 rounded overflow-hidden" style="background: var(--bg-tertiary);">
											<img
												src={data.book.coverImageUrl || '/placeholder.png'}
												alt={data.book.title}
												class="w-full h-full object-cover"
											/>
										</div>
										<div class="min-w-0 flex-1">
											<p class="font-medium text-sm sm:text-base truncate" style="color: var(--text-primary);">{data.book.title}</p>
											<p class="text-xs sm:text-sm" style="color: var(--text-muted);">
												{data.book.format?.name || 'Ebook'} • {data.book.pageCount ? `${data.book.pageCount} pages` : 'Digital format'}
											</p>
											<!-- Reading progress -->
											{#if ebookProgress && ebookProgress.percentage > 0}
												<div class="flex items-center gap-2 mt-1.5">
													<div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: var(--bg-tertiary);">
														<div
															class="h-full rounded-full transition-all"
															style="width: {Math.min(ebookProgress.percentage, 100)}%; background: var(--accent);"
														></div>
													</div>
													<span class="text-xs font-medium" style="color: var(--accent);">
														{Math.round(ebookProgress.percentage)}%
													</span>
												</div>
												{#if data.book.lastReadAt}
													<p class="text-xs mt-0.5" style="color: var(--text-muted);">
														Last read {formatRelativeTime(data.book.lastReadAt)}
													</p>
												{/if}
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-2 w-full sm:w-auto">
										<a
											href="/reader/{data.book.id}"
											class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-white font-medium text-sm"
											style="background: var(--accent);"
										>
											<BookOpen class="w-4 h-4" />
											{#if ebookProgress && ebookProgress.percentage > 0 && ebookProgress.percentage < 100}
												Continue
											{:else}
												Read
											{/if}
										</a>
										<a
											href="/api/ebooks/{data.book.id}/download"
											class="flex items-center gap-2 px-3 py-2 rounded-lg"
											style="background: var(--bg-tertiary); color: var(--text-primary);"
											title="Download"
										>
											<Download class="w-4 h-4" />
										</a>
									</div>
								</div>
							</div>
						{:else}
							<div class="card p-4 text-center" style="border: 1px dashed var(--border-color);">
								<p class="text-sm mb-3" style="color: var(--text-muted);">
									No ebook file attached.
								</p>
								<a
									href="/books/{data.book.id}/edit?tab=media"
									class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
									style="background: var(--bg-tertiary); color: var(--text-primary);"
								>
									<Upload class="w-4 h-4" />
									Upload Ebook
								</a>
							</div>
						{/if}
					</div>

					<!-- Audiobookshelf Section -->
					{#if canLinkAbs}
						<div>
							<h3 class="text-sm font-semibold mb-2 sm:mb-3 flex items-center gap-2" style="color: var(--text-primary);">
								<Headphones class="w-4 h-4" />
								Audiobookshelf
							</h3>
							<div class="card p-3 sm:p-4">
								<AbsLinkSection
									bookId={data.book.id}
									absItemId={data.book.absItemId ?? null}
									absBaseUrl={data.absBaseUrl ?? ''}
									initialQuery={data.book.title}
									onChange={() => invalidateAll()}
								/>
							</div>
						</div>
					{/if}
				</div>
				{:else if activeTab === 'similar'}
				<!-- Similar Books Tab -->
				<div class="card p-4">
					<!-- Similar Books from Library -->
					<h3 class="font-semibold mb-3" style="color: var(--text-primary);">From Your Library</h3>
					{#if data.similarBooks && data.similarBooks.length > 0}
						<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
							{#each data.similarBooks as book}
								<a
									href="/books/{book.id}"
									class="group rounded-lg overflow-hidden transition-shadow hover:shadow-lg"
									style="background-color: var(--bg-tertiary);"
								>
									<div class="aspect-[2/3] relative overflow-hidden">
										<!-- Blurred background -->
										{#if book.coverImageUrl}
											<img
												src={book.coverImageUrl}
												alt=""
												class="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60"
												loading="lazy"
												aria-hidden="true"
											/>
										{/if}
										<img
											src={book.coverImageUrl || '/placeholder.png'}
											alt={book.title}
											class="relative w-full h-full object-contain group-hover:scale-105 transition-transform drop-shadow-md"
											loading="lazy"
										/>
									</div>
									<div class="p-1.5">
										<p class="font-medium text-xs line-clamp-2" style="color: var(--text-primary);">{book.title}</p>
										{#if book.authorName}
											<p class="text-[10px] mt-0.5 truncate" style="color: var(--text-muted);">{book.authorName}</p>
										{/if}
									</div>
								</a>
							{/each}
						</div>
					{:else}
						<div class="text-center py-4">
							<p class="text-sm" style="color: var(--text-muted);">No similar books in your library</p>
						</div>
					{/if}

					<!-- AI Recommendations Section -->
					<div class="mt-6 pt-6" style="border-top: 1px solid var(--border-color);">
						<div class="flex items-center justify-between mb-3">
							<h3 class="font-semibold flex items-center gap-2" style="color: var(--text-primary);">
								<Wand2 class="w-4 h-4" style="color: var(--accent);" />
								AI Recommendations
							</h3>
							<button
								type="button"
								onclick={getAIRecommendations}
								disabled={loadingAI}
								class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
								style="background: var(--accent); color: white;"
							>
								{#if loadingAI}
									<Loader2 class="w-4 h-4 animate-spin" />
									Thinking...
								{:else}
									<Sparkles class="w-4 h-4" />
									Get Recommendations
								{/if}
							</button>
						</div>

						{#if aiError}
							<div class="p-3 rounded-lg text-sm" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
								{aiError}
							</div>
						{:else if aiRecommendations.length > 0}
							<div class="space-y-3">
								{#each aiRecommendations as rec}
									<div
										class="p-3 rounded-lg"
										style="background: var(--bg-tertiary); border: 1px solid var(--border-color);"
									>
										<div class="flex items-start justify-between gap-3">
											<div class="flex-1 min-w-0">
												<p class="font-medium" style="color: var(--text-primary);">
													{rec.title}
												</p>
												<p class="text-sm" style="color: var(--text-muted);">
													by {rec.author}
												</p>
												<p class="text-sm mt-1" style="color: var(--text-secondary);">
													{rec.reason}
												</p>
											</div>
											<div class="flex-shrink-0">
												{#if rec.inLibrary && rec.bookId}
													<a
														href="/books/{rec.bookId}"
														class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
														style="background: var(--bg-secondary); color: var(--text-primary);"
													>
														<BookOpen class="w-3.5 h-3.5" />
														View
													</a>
												{:else}
													<button
														type="button"
														onclick={() => addToWishlist(rec)}
														disabled={addingToLibrary === rec.title}
														class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
														style="background: var(--accent); color: white;"
													>
														{#if addingToLibrary === rec.title}
															<Loader2 class="w-3.5 h-3.5 animate-spin" />
														{:else}
															<BookPlus class="w-3.5 h-3.5" />
														{/if}
														Add to Wishlist
													</button>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						{:else if !loadingAI}
							<div class="text-center py-4">
								<p class="text-sm" style="color: var(--text-muted);">
									Click "Get Recommendations" to find similar books using AI
								</p>
							</div>
						{/if}
					</div>
				</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Delete Confirmation -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => { showDeleteConfirm = false; permanentDelete = false; }}>
		<div class="card p-6 max-w-md mx-4" onclick={(e) => e.stopPropagation()}>
			<h2 class="text-xl font-bold mb-4" style="color: var(--text-primary);">
				{isPublicLibraryBook ? 'Remove from Library?' : 'Delete Book?'}
			</h2>

			{#if isPublicLibraryBook}
				<p class="mb-4" style="color: var(--text-secondary);">
					This book is in the public library. Removing it will only remove it from your personal library.
				</p>

				{#if data.canManagePublicLibrary}
					<div class="mb-4 p-3 rounded-lg" style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color);">
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={permanentDelete}
								class="w-4 h-4 rounded"
								style="accent-color: #ef4444;"
							/>
							<span style="color: var(--text-primary);">
								<strong>Permanently delete</strong> from public library
							</span>
						</label>
						{#if permanentDelete}
							<p class="text-sm mt-2" style="color: #ef4444;">
								Warning: This will permanently delete the book for all users. This action cannot be undone.
							</p>
						{/if}
					</div>
				{/if}
			{:else}
				<p class="mb-6" style="color: var(--text-secondary);">
					Are you sure you want to delete "{data.book.title}"? This action cannot be undone.
				</p>
			{/if}

			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="btn-ghost"
					onclick={() => { showDeleteConfirm = false; permanentDelete = false; }}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn-accent"
					style="background-color: {permanentDelete ? '#dc2626' : '#ef4444'};"
					onclick={handleDelete}
				>
					{permanentDelete ? 'Permanently Delete' : (isPublicLibraryBook ? 'Remove' : 'Delete')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Metadata Search Modal -->
<MetadataSearchModal
	open={showMetadataModal}
	initialTitle={data.book.title}
	initialAuthor={data.book.authors[0]?.name || ''}
	initialIsbn={data.book.isbn13 || data.book.isbn10 || ''}
	onClose={() => showMetadataModal = false}
	onApply={applyMetadataResult}
/>

<style>
	/* Inline Edit Button */
	.inline-edit-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.375rem;
		border-radius: 0.375rem;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.inline-edit-btn:hover {
		color: var(--accent);
		background-color: var(--bg-tertiary);
	}

	/* Inline Edit Content (clickable area) */
	.inline-edit-content {
		width: 100%;
		text-align: left;
		background: none;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		padding: 0.5rem;
		margin: -0.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.inline-edit-content:hover {
		background-color: var(--bg-tertiary);
		border-color: var(--border-color);
	}

	.text-placeholder {
		color: var(--text-muted);
		font-style: italic;
	}

	/* Inline Edit Container */
	.inline-edit-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.inline-edit-textarea {
		width: 100%;
		padding: 0.75rem;
		background-color: var(--bg-tertiary);
		border: 1px solid var(--accent);
		border-radius: 0.5rem;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.9rem;
		line-height: 1.6;
		resize: vertical;
	}

	.inline-edit-textarea:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
	}

	.inline-edit-textarea::placeholder {
		color: var(--text-muted);
	}

	/* Inline Edit Actions */
	.inline-edit-actions {
		display: flex;
		gap: 0.5rem;
	}

	.inline-save-btn,
	.inline-cancel-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.inline-save-btn {
		background-color: var(--success, #10b981);
		color: white;
	}

	.inline-save-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.inline-save-btn:disabled,
	.inline-cancel-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.inline-cancel-btn {
		background-color: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.inline-cancel-btn:hover:not(:disabled) {
		background-color: var(--bg-hover);
		color: var(--text-primary);
	}

	/* Tab Navigation */
	.tab-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-muted);
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s;
		margin-bottom: -1px;
	}

	.tab-btn:hover {
		color: var(--text-primary);
		background-color: var(--bg-tertiary);
	}

	.tab-btn.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	/* Inline Rating Stars */
	.rating-star {
		background: transparent;
		border: none;
		cursor: pointer;
		line-height: 1;
	}

	.rating-star:focus {
		outline: none;
	}

	.rating-star:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 4px;
	}

	/* Status Select */
	.status-select {
		appearance: none;
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
		background-position: right 0.5rem center;
		background-repeat: no-repeat;
		background-size: 1.5em 1.5em;
		padding-right: 2.5rem;
	}

	.status-select:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.status-select:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.status-select option {
		background-color: var(--bg-primary);
		color: var(--text-primary);
	}
</style>
