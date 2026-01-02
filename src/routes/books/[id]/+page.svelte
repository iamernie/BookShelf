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
		Search,
		Sparkles,
		Calendar,
		BookMarked,
		Globe,
		Library,
		Headphones,
		Play,
		Clock,
		Plus,
		Music,
		HardDrive,
		Upload,
		RotateCcw,
		CheckCircle,
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
	import AudioPlayer from '$lib/components/audiobook/AudioPlayer.svelte';
	import InlineTagEditor from '$lib/components/tag/InlineTagEditor.svelte';

	let { data } = $props();

	// Tab state - check URL for listen parameter
	const initialTab = data.autoPlayAudiobook && data.linkedAudiobooks.length > 0 ? 'listen' : 'details';
	let activeTab = $state<'details' | 'media' | 'listen' | 'similar'>(initialTab);

	// Audio player state
	let showPlayer = $state(data.autoPlayAudiobook && data.linkedAudiobooks.length > 0);
	let selectedAudiobookIndex = $state(0);
	const selectedAudiobook = $derived(data.audiobookData[selectedAudiobookIndex]);

	// Check if there's any media (ebook or audiobook)
	const hasEbook = $derived(!!data.book.ebookPath);
	const hasAudiobook = $derived(data.linkedAudiobooks.length > 0);
	const hasAnyMedia = $derived(hasEbook || hasAudiobook);

	// Helper for formatting audiobook duration
	function formatDuration(seconds: number): string {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (hrs > 0) {
			return `${hrs}h ${mins}m`;
		}
		return `${mins}m`;
	}

	// Get progress percentage for an audiobook
	function getProgressPercent(audiobook: typeof data.linkedAudiobooks[0]): number {
		if (!audiobook.userProgress) return 0;
		return Math.round((audiobook.userProgress.progress ?? 0) * 100);
	}

	// Format file size
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
	}

	// Get file extension for format display
	function getFileFormat(filename: string): string {
		const ext = filename.split('.').pop()?.toUpperCase() || 'AUDIO';
		return ext;
	}

	// Format time for remaining display
	function formatTimeRemaining(seconds: number): string {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (hrs > 0) {
			return `${hrs}h ${mins}m remaining`;
		}
		return `${mins}m remaining`;
	}

	// Handle progress update from player
	async function handleProgressUpdate(currentTime: number, currentFileId: number, playbackRate: number) {
		if (!selectedAudiobook) return;
		try {
			await fetch(`/api/audiobooks/${selectedAudiobook.audiobook.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentTime, currentFileId, playbackRate })
			});
		} catch (e) {
			console.error('Failed to save progress:', e);
		}
	}

	// Handle audiobook ended
	async function handleAudiobookEnded() {
		if (!selectedAudiobook) return;
		try {
			await fetch(`/api/audiobooks/${selectedAudiobook.audiobook.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'finish' })
			});
			toasts.success('Audiobook completed!');
			invalidateAll();
		} catch (e) {
			console.error('Failed to mark as finished:', e);
		}
	}

	// Reset audiobook progress
	async function resetAudiobookProgress() {
		if (!selectedAudiobook) return;
		try {
			await fetch(`/api/audiobooks/${selectedAudiobook.audiobook.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'reset' })
			});
			toasts.success('Progress reset');
			invalidateAll();
		} catch (e) {
			console.error('Failed to reset progress:', e);
			toasts.error('Failed to reset progress');
		}
	}

	// Mark audiobook as finished
	async function markAudiobookFinished() {
		if (!selectedAudiobook) return;
		try {
			await fetch(`/api/audiobooks/${selectedAudiobook.audiobook.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'finish' })
			});
			toasts.success('Marked as finished');
			invalidateAll();
		} catch (e) {
			console.error('Failed to mark as finished:', e);
			toasts.error('Failed to mark as finished');
		}
	}

	// Start listening
	function startListening() {
		showPlayer = true;
		activeTab = 'listen';
	}

	let showDeleteConfirm = $state(false);
	let permanentDelete = $state(false);

	// Inline rating/status state
	let currentRating = $state(data.book.rating ?? 0);
	let currentStatusId = $state(data.book.statusId);
	let savingRating = $state(false);
	let savingStatus = $state(false);
	let hoverRating = $state(0);

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
</script>

<svelte:head>
	<title>{data.book.title} - BookShelf</title>
</svelte:head>

<div class="min-h-full" style="background-color: var(--bg-primary);" class:pb-40={showPlayer}>
	<!-- Header -->
	<div class="sticky top-0 z-10 px-3 sm:px-6 py-3 sm:py-4" style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
		<div class="max-w-6xl mx-auto flex items-center justify-between gap-2">
			<button
				type="button"
				class="flex items-center gap-1 sm:gap-2 transition-colors flex-shrink-0"
				style="color: var(--text-secondary);"
				onclick={() => history.back()}
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
				{#if data.linkedAudiobooks.length > 0}
					{@const anyAudioMissing = data.audiobookData.some(a => a.filesMissing)}
					{#if anyAudioMissing}
						<span
							class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm rounded-lg"
							style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"
							title="Audio files not found on server"
						>
							<AlertTriangle class="w-4 h-4" />
							<span class="hidden xs:inline">Audio Missing</span>
						</span>
					{:else}
						<button
							type="button"
							onclick={startListening}
							class="btn-ghost flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm"
							style="background: var(--bg-tertiary);"
						>
							<Headphones class="w-4 h-4" />
							<span class="hidden xs:inline">Listen</span>
						</button>
					{/if}
				{/if}
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
		{#if data.ebookMissing || data.audiobookData.some(a => a.filesMissing)}
			<div
				class="mb-4 p-4 rounded-lg flex items-start gap-3"
				style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);"
			>
				<AlertTriangle class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: #ef4444;" />
				<div>
					<p class="font-medium" style="color: #ef4444;">Missing Media Files</p>
					<p class="text-sm mt-1" style="color: var(--text-muted);">
						{#if data.ebookMissing && data.audiobookData.some(a => a.filesMissing)}
							The ebook and audiobook files for this book could not be found on the server. They may need to be re-uploaded.
						{:else if data.ebookMissing}
							The ebook file for this book could not be found on the server. It may need to be re-uploaded.
						{:else}
							The audiobook files for this book could not be found on the server. They may need to be re-uploaded.
						{/if}
					</p>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<!-- Left Column: Cover + Quick Info -->
			<div class="lg:col-span-1">
				<!-- Cover -->
				<div class="relative aspect-[2/3] rounded-lg overflow-hidden shadow-lg mb-3" style="background-color: var(--bg-tertiary);">
					<img
						src={data.book.coverImageUrl || '/placeholder.png'}
						alt={data.book.title}
						class="w-full h-full object-cover"
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
									{s.title}{#if s.bookNum} <span style="color: var(--text-secondary);">{formatSeriesNumber(s)}</span>{/if}
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
						{#if hasAudiobook}
							<button
								type="button"
								class="tab-btn"
								class:active={activeTab === 'listen'}
								onclick={() => { activeTab = 'listen'; showPlayer = true; }}
							>
								<Headphones class="w-4 h-4" />
								Listen
								{#if selectedAudiobook?.progress && !selectedAudiobook.progress.isFinished && (selectedAudiobook.progress.progress ?? 0) > 0}
									<span class="ml-1 px-1.5 py-0.5 text-xs rounded-full" style="background: var(--accent); color: white;">
										{Math.round((selectedAudiobook.progress.progress ?? 0) * 100)}%
									</span>
								{/if}
							</button>
						{/if}
						<button
							type="button"
							class="tab-btn"
							class:active={activeTab === 'media'}
							onclick={() => activeTab = 'media'}
						>
							<Music class="w-4 h-4" />
							Media
							{#if hasEbook || hasAudiobook}
								<span class="ml-1 px-1.5 py-0.5 text-xs rounded-full" style="background: var(--bg-tertiary); color: var(--text-muted);">
									{(hasEbook ? 1 : 0) + data.linkedAudiobooks.length}
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
				{:else if activeTab === 'listen'}
				<!-- Listen Tab - Embedded Audio Player -->
				{#if selectedAudiobook}
					<div class="space-y-4 sm:space-y-6">
						<!-- Player Info & Controls -->
						<div class="card p-4 sm:p-6">
							<div class="flex flex-col sm:flex-row gap-4 sm:gap-6">
								<!-- Cover -->
								<div class="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden shadow-lg mx-auto sm:mx-0" style="background: var(--bg-tertiary);">
									{#if selectedAudiobook.audiobook.coverPath}
										<img
											src={selectedAudiobook.audiobook.coverPath}
											alt={selectedAudiobook.audiobook.title}
											class="w-full h-full object-cover"
										/>
									{:else if data.book.coverImageUrl}
										<img
											src={data.book.coverImageUrl}
											alt={data.book.title}
											class="w-full h-full object-cover"
										/>
									{:else}
										<div class="w-full h-full flex items-center justify-center">
											<Headphones class="w-10 h-10 sm:w-12 sm:h-12" style="color: var(--text-muted);" />
										</div>
									{/if}
								</div>

								<!-- Info -->
								<div class="flex-1 text-center sm:text-left">
									<h3 class="text-lg sm:text-xl font-bold mb-1" style="color: var(--text-primary);">{selectedAudiobook.audiobook.title}</h3>
									{#if selectedAudiobook.audiobook.author}
										<p class="text-sm mb-1 sm:mb-2" style="color: var(--text-muted);">by {selectedAudiobook.audiobook.author}</p>
									{/if}
									{#if selectedAudiobook.audiobook.narratorName}
										<p class="text-sm mb-2 sm:mb-3" style="color: var(--text-muted);">Narrated by {selectedAudiobook.audiobook.narratorName}</p>
									{/if}

									<!-- Stats -->
									<div class="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4 justify-center sm:justify-start">
										<div class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg" style="background: var(--bg-secondary);">
											<Clock class="w-3.5 h-3.5 sm:w-4 sm:h-4" style="color: var(--text-muted);" />
											<span class="text-xs sm:text-sm" style="color: var(--text-primary);">{formatDuration(selectedAudiobook.audiobook.duration ?? 0)}</span>
										</div>
										{#if selectedAudiobook.audiobook.files.length > 1}
											<div class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg" style="background: var(--bg-secondary);">
												<Music class="w-3.5 h-3.5 sm:w-4 sm:h-4" style="color: var(--text-muted);" />
												<span class="text-xs sm:text-sm" style="color: var(--text-primary);">{selectedAudiobook.audiobook.files.length} tracks</span>
											</div>
										{/if}
									</div>

									<!-- Progress Info -->
									{#if selectedAudiobook.progress}
										{@const progressPercent = Math.round((selectedAudiobook.progress.progress ?? 0) * 100)}
										{@const remainingTime = (selectedAudiobook.audiobook.duration ?? 0) - (selectedAudiobook.progress.currentTime ?? 0)}
										{#if selectedAudiobook.progress.isFinished}
											<div class="flex items-center gap-2 text-green-500 mb-3 sm:mb-4 justify-center sm:justify-start">
												<CheckCircle class="w-5 h-5" />
												<span class="font-medium">Completed</span>
											</div>
										{:else if progressPercent > 0}
											<div class="mb-3 sm:mb-4">
												<div class="flex items-center justify-between text-xs sm:text-sm mb-1">
													<span style="color: var(--text-muted);">{progressPercent}% complete</span>
													<span style="color: var(--text-muted);">{formatTimeRemaining(remainingTime)}</span>
												</div>
												<div class="h-2 rounded-full overflow-hidden" style="background: var(--bg-tertiary);">
													<div class="h-full rounded-full transition-all" style="width: {progressPercent}%; background: var(--accent);"></div>
												</div>
											</div>
										{/if}
									{/if}

									<!-- Action buttons -->
									<div class="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
										{#if selectedAudiobook.progress && !selectedAudiobook.progress.isFinished && (selectedAudiobook.progress.progress ?? 0) > 0}
											<button
												type="button"
												onclick={markAudiobookFinished}
												class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm"
												style="background: var(--bg-secondary); color: var(--text-primary);"
												title="Mark as finished"
											>
												<CheckCircle class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
												<span class="hidden xs:inline">Mark</span> Finished
											</button>
										{/if}
										{#if selectedAudiobook.progress && (selectedAudiobook.progress.progress ?? 0) > 0}
											<button
												type="button"
												onclick={resetAudiobookProgress}
												class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm"
												style="background: var(--bg-secondary); color: var(--text-primary);"
												title="Reset progress"
											>
												<RotateCcw class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
												Reset
											</button>
										{/if}
									</div>
								</div>
							</div>
						</div>

						<!-- Track List with File Info -->
						{#if selectedAudiobook.audiobook.files.length > 0}
							<div class="card p-3 sm:p-4">
								<h4 class="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base" style="color: var(--text-primary);">
									<Music class="w-4 h-4" />
									Tracks
								</h4>
								<div class="space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
									{#each selectedAudiobook.audiobook.files as file, i}
										<div class="flex items-center justify-between py-2 px-2 sm:px-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
											<div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
												<span class="text-xs font-mono flex-shrink-0 w-4 text-center" style="color: var(--text-muted);">{file.trackNumber}</span>
												<span class="text-xs sm:text-sm truncate" style="color: var(--text-primary);">
													{file.title || file.filename}
												</span>
											</div>
											<div class="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-2">
												<!-- Format badge - hidden on mobile -->
												<span class="hidden sm:inline text-xs px-2 py-0.5 rounded" style="background: var(--bg-tertiary); color: var(--text-muted);">
													{getFileFormat(file.filename)}
												</span>
												<!-- File size - hidden on mobile -->
												{#if file.fileSize}
													<span class="hidden md:inline text-xs" style="color: var(--text-muted);">
														{formatFileSize(file.fileSize)}
													</span>
												{/if}
												<span class="text-xs font-mono" style="color: var(--text-muted);">
													{formatDuration(file.duration)}
												</span>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Bookmarks -->
						{#if selectedAudiobook.bookmarks.length > 0}
							<div class="card p-3 sm:p-4">
								<h4 class="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base" style="color: var(--text-primary);">
									Bookmarks
								</h4>
								<div class="space-y-2">
									{#each selectedAudiobook.bookmarks as bookmark}
										<div class="flex items-center justify-between py-2 px-2 sm:px-3 rounded-lg" style="background: var(--bg-secondary);">
											<div class="min-w-0 flex-1">
												<span class="text-xs sm:text-sm font-medium" style="color: var(--text-primary);">
													{bookmark.title || 'Bookmark'}
												</span>
												{#if bookmark.note}
													<p class="text-xs truncate" style="color: var(--text-muted);">{bookmark.note}</p>
												{/if}
											</div>
											<span class="text-xs font-mono flex-shrink-0 ml-2" style="color: var(--text-muted);">
												{formatDuration(bookmark.time)}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="card p-6 sm:p-8 text-center">
						<Headphones class="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3" style="color: var(--text-muted);" />
						<p class="text-sm" style="color: var(--text-muted);">No audiobook available</p>
					</div>
				{/if}
				{:else if activeTab === 'media'}
				<!-- Media Tab - Ebook & Audiobook -->
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
										</div>
									</div>
									<div class="flex items-center gap-2 w-full sm:w-auto">
										<a
											href="/reader/{data.book.id}"
											class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-white font-medium text-sm"
											style="background: var(--accent);"
										>
											<BookOpen class="w-4 h-4" />
											Read
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

					<!-- Audiobook Section -->
					<div>
						<h3 class="text-sm font-semibold mb-2 sm:mb-3 flex items-center gap-2" style="color: var(--text-primary);">
							<Headphones class="w-4 h-4" />
							Audiobook
						</h3>
						{#if data.linkedAudiobooks.length > 0}
							{#each data.linkedAudiobooks as audiobook}
								<div class="card p-3 sm:p-4 mb-3">
									<div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
										<div class="flex items-start gap-3 flex-1 min-w-0">
											<div class="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 rounded-lg overflow-hidden" style="background: var(--bg-tertiary);">
												{#if audiobook.coverPath}
													<img
														src={audiobook.coverPath}
														alt={audiobook.title}
														class="w-full h-full object-cover"
													/>
												{:else}
													<div class="w-full h-full flex items-center justify-center">
														<Headphones class="w-5 h-5 sm:w-6 sm:h-6" style="color: var(--text-muted);" />
													</div>
												{/if}
											</div>

											<div class="flex-1 min-w-0">
												<p class="font-medium text-sm sm:text-base" style="color: var(--text-primary);">{audiobook.title}</p>
												{#if audiobook.narratorName}
													<p class="text-xs sm:text-sm" style="color: var(--text-muted);">
														Narrated by {audiobook.narratorName}
													</p>
												{/if}
												<div class="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm mt-1">
													{#if audiobook.duration}
														<span class="flex items-center gap-1" style="color: var(--text-muted);">
															<Clock class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
															{formatDuration(audiobook.duration)}
														</span>
													{/if}
													{#if audiobook.userProgress}
														{@const progress = getProgressPercent(audiobook)}
														{#if audiobook.userProgress.isFinished}
															<span class="flex items-center gap-1 text-green-500 text-xs">
																<Check class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
																Completed
															</span>
														{:else if progress > 0}
															<span class="text-xs" style="color: var(--accent);">
																{progress}% complete
															</span>
														{/if}
													{/if}
												</div>
												{#if audiobook.userProgress && getProgressPercent(audiobook) > 0 && !audiobook.userProgress.isFinished}
													<div class="mt-2 h-1 rounded-full overflow-hidden" style="background: var(--bg-tertiary);">
														<div class="h-full rounded-full" style="width: {getProgressPercent(audiobook)}%; background: var(--accent);"></div>
													</div>
												{/if}
											</div>
										</div>

										<div class="flex items-center gap-2 sm:self-center">
											<button
												type="button"
												onclick={startListening}
												class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-white font-medium text-sm"
												style="background: var(--accent);"
											>
												<Play class="w-4 h-4" />
												{#if audiobook.userProgress && getProgressPercent(audiobook) > 0 && !audiobook.userProgress.isFinished}
													Continue
												{:else if audiobook.userProgress?.isFinished}
													Replay
												{:else}
													Listen
												{/if}
											</button>
										</div>
									</div>
								</div>
							{/each}
						{:else}
							<div class="card p-4 text-center" style="border: 1px dashed var(--border-color);">
								<p class="text-sm mb-3" style="color: var(--text-muted);">
									No audiobook linked to this book.
								</p>
								<a
									href="/books/{data.book.id}/edit?tab=media"
									class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
									style="background: var(--bg-tertiary); color: var(--text-primary);"
								>
									<Plus class="w-4 h-4" />
									Add Audiobook
								</a>
							</div>
						{/if}
					</div>
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
									<div class="aspect-[2/3] relative">
										<img
											src={book.coverImageUrl || '/placeholder.png'}
											alt={book.title}
											class="w-full h-full object-cover group-hover:scale-105 transition-transform"
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

<!-- Audio Player (fixed at bottom) -->
{#if showPlayer && selectedAudiobook}
	<AudioPlayer
		audiobookId={selectedAudiobook.audiobook.id}
		title={selectedAudiobook.audiobook.title}
		author={selectedAudiobook.audiobook.author}
		coverPath={selectedAudiobook.audiobook.coverPath || data.book.coverImageUrl}
		tracks={selectedAudiobook.audiobook.files.map(f => ({
			id: f.id,
			filename: f.filename,
			filePath: f.filePath,
			duration: f.duration,
			startOffset: f.startOffset ?? 0,
			trackNumber: f.trackNumber,
			title: f.title
		}))}
		chapters={selectedAudiobook.audiobook.chapters?.map(c => ({
			id: c.id,
			audiobookId: c.audiobookId,
			title: c.title,
			startTime: c.startTime,
			endTime: c.endTime,
			chapterNumber: c.chapterNumber
		})) ?? []}
		initialTime={selectedAudiobook.progress?.currentTime ?? 0}
		initialPlaybackRate={selectedAudiobook.progress?.playbackRate ?? 1}
		onProgressUpdate={handleProgressUpdate}
		onEnded={handleAudiobookEnded}
	/>
{/if}

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
