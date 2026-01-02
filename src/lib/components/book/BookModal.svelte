<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import MetadataSearchModal from '$lib/components/book/MetadataSearchModal.svelte';
	import {
		BookOpen, Star, Calendar, Edit2, Trash2, BookMarked, User, Library, Tag, X,
		Info, AlignLeft, Fingerprint, Image, CalendarDays, Tablet, Download, Search, Loader2, Database, Plus
	} from 'lucide-svelte';
	import type { BookWithRelations } from '$lib/server/services/bookService';
	import { toasts } from '$lib/stores/toast';
	import { toInputDate } from '$lib/utils/date';

	interface FormOptions {
		statuses: { id: number; name: string; color: string | null }[];
		genres: { id: number; name: string }[];
		formats: { id: number; name: string }[];
		narrators: { id: number; name: string }[];
		tags: { id: number; name: string; color: string | null }[];
		authors: { id: number; name: string }[];
		series: { id: number; title: string }[];
	}

	let {
		book,
		options,
		mode = 'view',
		onClose,
		onSave,
		onDelete
	}: {
		book: BookWithRelations | null;
		options: FormOptions;
		mode: 'view' | 'edit' | 'add';
		onClose: () => void;
		onSave: (data: any) => Promise<void>;
		onDelete?: () => Promise<void>;
	} = $props();

	let currentMode = $state(mode);
	let saving = $state(false);
	let deleting = $state(false);
	let activeTab = $state<'basic' | 'summary' | 'identifiers' | 'cover' | 'dates' | 'ebook'>('basic');

	// Form fields
	let title = $state(book?.title || '');
	let summary = $state(book?.summary || '');
	let comments = $state(book?.comments || '');
	let rating = $state(book?.rating?.toString() || '');
	let coverImageUrl = $state(book?.coverImageUrl || '');
	let originalCoverUrl = $state(book?.originalCoverUrl || '');
	let statusId = $state(book?.statusId?.toString() || '');
	let formatId = $state(book?.formatId?.toString() || '');
	let releaseDate = $state(toInputDate(book?.releaseDate));
	let startReadingDate = $state(toInputDate(book?.startReadingDate));
	let completedDate = $state(toInputDate(book?.completedDate));
	let isbn10 = $state(book?.isbn10 || '');
	let isbn13 = $state(book?.isbn13 || '');
	let asin = $state(book?.asin || '');
	let goodreadsId = $state(book?.goodreadsId || '');
	let googleBooksId = $state(book?.googleBooksId || '');
	let pageCount = $state(book?.pageCount?.toString() || '');
	let publisher = $state(book?.publisher || '');
	let publishYear = $state(book?.publishYear?.toString() || '');
	let edition = $state(book?.edition || '');
	let language = $state(book?.language || 'English');
	let purchasePrice = $state(book?.purchasePrice?.toString() || '');
	let ebookPath = $state(book?.ebookPath || '');

	// Cover download state
	let downloadingCover = $state(false);
	let coverPreviewUrl = $derived(coverImageUrl || originalCoverUrl || '');

	// Ebook upload state
	let uploadingEbook = $state(false);
	let ebookDragOver = $state(false);
	let ebookInputRef = $state<HTMLInputElement | null>(null);

	// ISBN lookup state
	let lookupLoading = $state(false);
	let lookupIsbn = $state('');

	// Metadata search modal
	let showMetadataModal = $state(false);

	// Relations
	let selectedAuthors = $state<{ id: number; name: string; role: string }[]>(
		book?.authors?.map(a => ({ id: a.id, name: a.name, role: a.role || 'Author' })) || []
	);
	let selectedSeries = $state<{ id: number; title: string; bookNum: string; bookNumEnd: string }[]>(
		book?.series?.map(s => ({ id: s.id, title: s.title, bookNum: s.bookNum?.toString() || '', bookNumEnd: s.bookNumEnd?.toString() || '' })) || []
	);
	let selectedTagIds = $state<number[]>(book?.tags?.map(t => t.id) || []);

	// Author picker state
	let authorSearch = $state('');
	let authorRole = $state('Author');
	let showAuthorDropdown = $state(false);
	let creatingAuthor = $state(false);
	let availableAuthors = $state(options.authors);
	let filteredAuthors = $derived(
		availableAuthors.filter(a =>
			a.name.toLowerCase().includes(authorSearch.toLowerCase()) &&
			!selectedAuthors.some(sa => sa.id === a.id)
		).slice(0, 10)
	);
	let canCreateAuthor = $derived(
		authorSearch.trim().length > 0 &&
		!availableAuthors.some(a => a.name.toLowerCase() === authorSearch.trim().toLowerCase())
	);

	// Series picker state
	let seriesSearch = $state('');
	let seriesBookNum = $state('');
	let showSeriesDropdown = $state(false);
	let creatingSeries = $state(false);
	let availableSeries = $state(options.series);
	let filteredSeries = $derived(
		availableSeries.filter(s =>
			s.title.toLowerCase().includes(seriesSearch.toLowerCase()) &&
			!selectedSeries.some(ss => ss.id === s.id)
		).slice(0, 10)
	);
	let canCreateSeries = $derived(
		seriesSearch.trim().length > 0 &&
		!availableSeries.some(s => s.title.toLowerCase() === seriesSearch.trim().toLowerCase())
	);

	// Narrator picker state
	let narratorSearch = $state('');
	let showNarratorDropdown = $state(false);
	let creatingNarrator = $state(false);
	let availableNarrators = $state(options.narrators);
	let filteredNarrators = $derived(
		availableNarrators.filter(n =>
			n.name.toLowerCase().includes(narratorSearch.toLowerCase())
		).slice(0, 10)
	);
	let canCreateNarrator = $derived(
		narratorSearch.trim().length > 0 &&
		!availableNarrators.some(n => n.name.toLowerCase() === narratorSearch.trim().toLowerCase())
	);
	let selectedNarrator = $state<{ id: number; name: string } | null>(
		book?.narratorId ? options.narrators.find(n => n.id === book.narratorId) ?? null : null
	);

	// Genre picker state
	let genreSearch = $state('');
	let showGenreDropdown = $state(false);
	let creatingGenre = $state(false);
	let availableGenres = $state(options.genres);
	let filteredGenres = $derived(
		availableGenres.filter(g =>
			g.name.toLowerCase().includes(genreSearch.toLowerCase())
		).slice(0, 10)
	);
	let canCreateGenre = $derived(
		genreSearch.trim().length > 0 &&
		!availableGenres.some(g => g.name.toLowerCase() === genreSearch.trim().toLowerCase())
	);
	let selectedGenre = $state<{ id: number; name: string } | null>(
		book?.genreId ? options.genres.find(g => g.id === book.genreId) ?? null : null
	);

	// Tab definitions
	const tabs = [
		{ id: 'basic', label: 'Basic Info', icon: Info },
		{ id: 'summary', label: 'Summary', icon: AlignLeft },
		{ id: 'identifiers', label: 'Identifiers', icon: Fingerprint },
		{ id: 'cover', label: 'Cover Image', icon: Image },
		{ id: 'dates', label: 'Dates & Status', icon: CalendarDays },
		{ id: 'ebook', label: 'Ebook', icon: Tablet }
	] as const;

	function addAuthor(author: { id: number; name: string }) {
		selectedAuthors = [...selectedAuthors, { id: author.id, name: author.name, role: authorRole }];
		authorSearch = '';
		authorRole = 'Author';
		showAuthorDropdown = false;
	}

	function removeAuthor(id: number) {
		selectedAuthors = selectedAuthors.filter(a => a.id !== id);
	}

	function addSeries(s: { id: number; title: string }) {
		selectedSeries = [...selectedSeries, { id: s.id, title: s.title, bookNum: seriesBookNum, bookNumEnd: '' }];
		seriesSearch = '';
		seriesBookNum = '';
		showSeriesDropdown = false;
	}

	function removeSeries(id: number) {
		selectedSeries = selectedSeries.filter(s => s.id !== id);
	}

	async function createNewAuthor() {
		const name = authorSearch.trim();
		if (!name) return;

		creatingAuthor = true;
		try {
			const res = await fetch('/api/authors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			if (res.ok) {
				const newAuthor = await res.json();
				// Add to available authors list
				availableAuthors = [...availableAuthors, { id: newAuthor.id, name: newAuthor.name }];
				// Add to selected authors
				addAuthor({ id: newAuthor.id, name: newAuthor.name });
			}
		} catch (e) {
			console.error('Failed to create author:', e);
		} finally {
			creatingAuthor = false;
		}
	}

	async function createNewSeries() {
		const title = seriesSearch.trim();
		if (!title) return;

		creatingSeries = true;
		try {
			const res = await fetch('/api/series', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});

			if (res.ok) {
				const newSeries = await res.json();
				// Add to available series list
				availableSeries = [...availableSeries, { id: newSeries.id, title: newSeries.title }];
				// Add to selected series
				addSeries({ id: newSeries.id, title: newSeries.title });
			}
		} catch (e) {
			console.error('Failed to create series:', e);
		} finally {
			creatingSeries = false;
		}
	}

	async function createNewNarrator() {
		const name = narratorSearch.trim();
		if (!name) return;

		creatingNarrator = true;
		try {
			const res = await fetch('/api/narrators', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			if (res.ok) {
				const newNarrator = await res.json();
				availableNarrators = [...availableNarrators, { id: newNarrator.id, name: newNarrator.name }];
				selectedNarrator = { id: newNarrator.id, name: newNarrator.name };
				narratorSearch = '';
				showNarratorDropdown = false;
			}
		} catch (e) {
			console.error('Failed to create narrator:', e);
		} finally {
			creatingNarrator = false;
		}
	}

	async function createNewGenre() {
		const name = genreSearch.trim();
		if (!name) return;

		creatingGenre = true;
		try {
			const res = await fetch('/api/genres', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			if (res.ok) {
				const newGenre = await res.json();
				availableGenres = [...availableGenres, { id: newGenre.id, name: newGenre.name }];
				selectedGenre = { id: newGenre.id, name: newGenre.name };
				genreSearch = '';
				showGenreDropdown = false;
			}
		} catch (e) {
			console.error('Failed to create genre:', e);
		} finally {
			creatingGenre = false;
		}
	}

	function selectNarrator(n: { id: number; name: string }) {
		selectedNarrator = n;
		narratorSearch = '';
		showNarratorDropdown = false;
	}

	function clearNarrator() {
		selectedNarrator = null;
	}

	function selectGenre(g: { id: number; name: string }) {
		selectedGenre = g;
		genreSearch = '';
		showGenreDropdown = false;
	}

	function clearGenre() {
		selectedGenre = null;
	}

	function toggleTag(tagId: number) {
		if (selectedTagIds.includes(tagId)) {
			selectedTagIds = selectedTagIds.filter(id => id !== tagId);
		} else {
			selectedTagIds = [...selectedTagIds, tagId];
		}
	}

	async function downloadCover() {
		if (!originalCoverUrl) return;
		downloadingCover = true;
		try {
			const res = await fetch('/api/covers/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: originalCoverUrl, bookId: book?.id })
			});
			if (res.ok) {
				const data = await res.json();
				coverImageUrl = data.coverPath;
				toasts.success('Cover image downloaded');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to download cover');
			}
		} catch {
			toasts.error('Failed to download cover image');
		} finally {
			downloadingCover = false;
		}
	}

	async function lookupByIsbn() {
		if (!lookupIsbn.trim()) return;
		lookupLoading = true;
		try {
			const res = await fetch(`/api/books/lookup?isbn=${encodeURIComponent(lookupIsbn.trim())}`);
			if (res.ok) {
				const data = await res.json();
				applyLookupData(data);
				toasts.success('Book data found');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Book not found');
			}
		} catch {
			toasts.error('Lookup failed');
		} finally {
			lookupLoading = false;
		}
	}

	async function autoSearch() {
		if (!title.trim()) {
			toasts.error('Enter a title first');
			return;
		}
		lookupLoading = true;
		try {
			const authorName = selectedAuthors[0]?.name || '';
			const res = await fetch(`/api/books/lookup?title=${encodeURIComponent(title)}&author=${encodeURIComponent(authorName)}`);
			if (res.ok) {
				const data = await res.json();
				applyLookupData(data);
				toasts.success('Book data found');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Book not found');
			}
		} catch {
			toasts.error('Lookup failed');
		} finally {
			lookupLoading = false;
		}
	}

	function applyLookupData(data: any) {
		if (data.title && !title) title = data.title;
		if (data.summary && !summary) summary = data.summary;
		if (data.publisher && !publisher) publisher = data.publisher;
		if (data.publishYear && !publishYear) publishYear = data.publishYear.toString();
		if (data.pageCount && !pageCount) pageCount = data.pageCount.toString();
		if (data.language && !language) language = data.language;
		if (data.isbn13 && !isbn13) isbn13 = data.isbn13;
		if (data.isbn10 && !isbn10) isbn10 = data.isbn10;
		if (data.coverUrl && !originalCoverUrl) originalCoverUrl = data.coverUrl;
	}

	function applyMetadataResult(result: any, selectedFields: string[]) {
		for (const field of selectedFields) {
			switch (field) {
				case 'title':
					if (result.title) title = result.title;
					break;
				case 'summary':
					if (result.description) summary = result.description;
					break;
				case 'coverUrl':
					if (result.coverUrl) originalCoverUrl = result.coverUrl;
					break;
				case 'isbn13':
					if (result.isbn13) isbn13 = result.isbn13;
					break;
				case 'isbn10':
					if (result.isbn10) isbn10 = result.isbn10;
					break;
				case 'publisher':
					if (result.publisher) publisher = result.publisher;
					break;
				case 'publishYear':
					if (result.publishYear) publishYear = result.publishYear.toString();
					break;
				case 'pageCount':
					if (result.pageCount) pageCount = result.pageCount.toString();
					break;
				case 'language':
					if (result.language) language = result.language;
					break;
				case 'rating':
					if (result.rating) rating = result.rating.toString();
					break;
			}
		}

		// Store provider IDs
		if (result.provider === 'goodreads' && result.providerId) {
			goodreadsId = result.providerId;
		} else if (result.provider === 'googlebooks' && result.providerId) {
			googleBooksId = result.providerId;
		}

		toasts.success(`Applied ${selectedFields.length} fields from ${result.provider}`);
	}

	// Ebook upload handling
	async function handleEbookUpload(file: File) {
		if (!book?.id) {
			toasts.error('Save the book first before uploading an ebook');
			return;
		}

		const allowedTypes = ['application/epub+zip', 'application/pdf', 'application/x-cbz'];
		const allowedExtensions = ['.epub', '.pdf', '.cbz'];
		const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

		if (!allowedExtensions.includes(ext)) {
			toasts.error('Only EPUB, PDF, and CBZ files are allowed');
			return;
		}

		if (file.size > 100 * 1024 * 1024) {
			toasts.error('File too large. Maximum size is 100MB');
			return;
		}

		uploadingEbook = true;
		try {
			const formData = new FormData();
			formData.append('ebook', file);

			const res = await fetch(`/api/ebooks/${book.id}/upload`, {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				const data = await res.json();
				ebookPath = data.ebookPath;
				toasts.success('Ebook uploaded successfully');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to upload ebook');
			}
		} catch {
			toasts.error('Upload failed');
		} finally {
			uploadingEbook = false;
		}
	}

	function handleEbookDrop(e: DragEvent) {
		e.preventDefault();
		ebookDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) {
			handleEbookUpload(file);
		}
	}

	function handleEbookSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			handleEbookUpload(file);
		}
	}

	async function removeEbook() {
		if (!book?.id || !confirm('Remove the ebook file?')) return;

		try {
			const res = await fetch(`/api/ebooks/${book.id}`, { method: 'DELETE' });
			if (res.ok) {
				ebookPath = '';
				toasts.success('Ebook removed');
			} else {
				toasts.error('Failed to remove ebook');
			}
		} catch {
			toasts.error('Failed to remove ebook');
		}
	}

	async function handleSave() {
		if (!title.trim()) return;
		saving = true;
		try {
			await onSave({
				title: title.trim(),
				summary: summary.trim() || null,
				comments: comments.trim() || null,
				rating: rating ? parseFloat(rating) : null,
				coverImageUrl: coverImageUrl.trim() || null,
				originalCoverUrl: originalCoverUrl.trim() || null,
				statusId: statusId ? parseInt(statusId) : null,
				genreId: selectedGenre?.id ?? null,
				formatId: formatId ? parseInt(formatId) : null,
				narratorId: selectedNarrator?.id ?? null,
				releaseDate: releaseDate || null,
				startReadingDate: startReadingDate || null,
				completedDate: completedDate || null,
				isbn10: isbn10.trim() || null,
				isbn13: isbn13.trim() || null,
				asin: asin.trim() || null,
				goodreadsId: goodreadsId.trim() || null,
				googleBooksId: googleBooksId.trim() || null,
				pageCount: pageCount ? parseInt(pageCount) : null,
				publisher: publisher.trim() || null,
				publishYear: publishYear ? parseInt(publishYear) : null,
				edition: edition.trim() || null,
				language: language.trim() || 'English',
				purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
				authors: selectedAuthors.map(a => ({ id: a.id, role: a.role })),
				series: selectedSeries.map(s => ({
					id: s.id,
					bookNum: s.bookNum ? parseFloat(s.bookNum) : null,
					bookNumEnd: s.bookNumEnd ? parseFloat(s.bookNumEnd) : null
				})),
				tagIds: selectedTagIds
			});
			onClose();
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!onDelete || !confirm('Are you sure you want to delete this book?')) return;
		deleting = true;
		try {
			await onDelete();
			onClose();
		} finally {
			deleting = false;
		}
	}

	function renderStars(rating: number | null) {
		if (!rating) return '';
		return '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '');
	}

	const languages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Japanese', 'Chinese', 'Korean', 'Arabic', 'Hindi', 'Dutch', 'Swedish', 'Polish', 'Other'];
	const authorRoles = ['Author', 'Co-Author', 'Editor', 'Translator', 'Illustrator', 'Contributor', 'Foreword By', 'Afterword By'];
</script>

<Modal open={true} onClose={onClose} title={currentMode === 'add' ? 'Add Book' : book?.title || 'Book'} size="xl">
	{#if currentMode === 'view' && book}
		<!-- View Mode -->
		<div class="p-6 space-y-6">
			<div class="flex gap-6">
				<!-- Cover -->
				<div class="flex-shrink-0">
					<img
						src={book.coverImageUrl || '/placeholder.png'}
						alt={book.title}
						class="w-40 h-60 object-cover rounded-lg shadow-md"
						onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
					/>
				</div>

				<!-- Details -->
				<div class="flex-1 space-y-3">
					{#if book.authors.length > 0}
						<p class="text-gray-600 flex items-center gap-2">
							<User class="w-4 h-4" />
							{book.authors.map(a => a.name + (a.role && a.role !== 'Author' ? ` (${a.role})` : '')).join(', ')}
						</p>
					{/if}

					{#if book.series.length > 0}
						<p class="text-gray-600 flex items-center gap-2">
							<Library class="w-4 h-4" />
							{book.series.map(s => `${s.title}${s.bookNum ? ` #${s.bookNum}${s.bookNumEnd ? `-${s.bookNumEnd}` : ''}` : ''}`).join(', ')}
						</p>
					{/if}

					{#if book.rating}
						<p class="text-yellow-500 flex items-center gap-2">
							<Star class="w-4 h-4 fill-current" />
							{renderStars(book.rating)} ({book.rating})
						</p>
					{/if}

					<div class="flex flex-wrap gap-2">
						{#if book.status}
							<span class="inline-block px-2 py-1 text-sm rounded text-white" style="background-color: {book.status.color || '#6c757d'}">
								{book.status.name}
							</span>
						{/if}

						{#if book.genre}
							<span class="inline-block px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded">
								{book.genre.name}
							</span>
						{/if}

						{#if book.format}
							<span class="inline-block px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded">
								{book.format.name}
							</span>
						{/if}
					</div>

					{#if book.tags.length > 0}
						<div class="flex flex-wrap gap-1 mt-2">
							{#each book.tags as tag}
								<span class="px-2 py-0.5 text-xs rounded text-white" style="background-color: {tag.color || '#6c757d'}">
									{tag.name}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			{#if book.summary}
				<div>
					<h3 class="text-sm font-medium text-gray-700 mb-2">Summary</h3>
					<p class="text-gray-600 whitespace-pre-wrap text-sm">{book.summary}</p>
				</div>
			{/if}

			{#if book.comments}
				<div>
					<h3 class="text-sm font-medium text-gray-700 mb-2">Notes</h3>
					<p class="text-gray-600 whitespace-pre-wrap text-sm">{book.comments}</p>
				</div>
			{/if}

			<!-- Metadata -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
				{#if book.pageCount}
					<div><span class="text-gray-500">Pages:</span> {book.pageCount}</div>
				{/if}
				{#if book.publisher}
					<div><span class="text-gray-500">Publisher:</span> {book.publisher}</div>
				{/if}
				{#if book.publishYear}
					<div><span class="text-gray-500">Published:</span> {book.publishYear}</div>
				{/if}
				{#if book.isbn13 || book.isbn10}
					<div><span class="text-gray-500">ISBN:</span> {book.isbn13 || book.isbn10}</div>
				{/if}
				{#if book.narrator}
					<div><span class="text-gray-500">Narrator:</span> {book.narrator.name}</div>
				{/if}
				{#if book.completedDate}
					<div><span class="text-gray-500">Completed:</span> {book.completedDate}</div>
				{/if}
				{#if book.startReadingDate}
					<div><span class="text-gray-500">Started:</span> {book.startReadingDate}</div>
				{/if}
				{#if book.language && book.language !== 'English'}
					<div><span class="text-gray-500">Language:</span> {book.language}</div>
				{/if}
			</div>

			<!-- Action buttons -->
			<div class="flex justify-between pt-4 border-t">
				<button
					type="button"
					class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
					onclick={handleDelete}
					disabled={deleting}
				>
					<Trash2 class="w-4 h-4" />
					Delete
				</button>
				<div class="flex gap-2">
					{#if book.ebookPath}
						<a
							href="/reader/{book.id}"
							class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
						>
							<BookMarked class="w-4 h-4" />
							Read
						</a>
					{/if}
					<button
						type="button"
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
						onclick={() => currentMode = 'edit'}
					>
						<Edit2 class="w-4 h-4" />
						Edit
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Edit/Add Mode with Tabs -->
		<div class="flex flex-col md:flex-row">
			<!-- Left Column - Cover Preview (hidden on mobile) -->
			<div class="hidden md:block w-48 p-4 bg-gray-50 border-r flex-shrink-0">
				<div class="sticky top-4">
					<div class="bg-white rounded-lg shadow-sm overflow-hidden mb-3">
						<img
							src={coverPreviewUrl || '/placeholder.png'}
							alt="Cover Preview"
							class="w-full aspect-[2/3] object-cover"
							onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
						/>
					</div>

					{#if ebookPath}
						<a href="/reader/{book?.id}" class="flex items-center justify-center gap-2 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
							<BookMarked class="w-4 h-4" />
							Read Ebook
						</a>
					{/if}

					<div class="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600">
						<p class="font-medium mb-1">Cover Image</p>
						<p>Use the "Cover Image" tab to add a URL or upload a file.</p>
					</div>
				</div>
			</div>

			<!-- Right Column - Form with Tabs -->
			<div class="flex-1 min-w-0">
				<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="flex flex-col h-full">
					<!-- Tab Navigation -->
					<div class="border-b bg-gray-50 px-4 overflow-x-auto">
						<div class="flex gap-1 py-2 min-w-max">
							{#each tabs as tab}
								<button
									type="button"
									class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap {activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}"
									onclick={() => activeTab = tab.id}
								>
									{#if tab.id === 'basic'}
										<Info class="w-4 h-4" />
									{:else if tab.id === 'summary'}
										<AlignLeft class="w-4 h-4" />
									{:else if tab.id === 'identifiers'}
										<Fingerprint class="w-4 h-4" />
									{:else if tab.id === 'cover'}
										<Image class="w-4 h-4" />
									{:else if tab.id === 'dates'}
										<CalendarDays class="w-4 h-4" />
									{:else if tab.id === 'ebook'}
										<Tablet class="w-4 h-4" />
									{/if}
									<span class="hidden sm:inline">{tab.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Tab Content -->
					<div class="flex-1 overflow-y-auto p-4 space-y-4" style="max-height: 60vh;">
						<!-- Basic Info Tab -->
						{#if activeTab === 'basic'}
							<div class="space-y-4">
								<!-- Quick Metadata Search -->
								<div class="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											<Database class="w-4 h-4 text-blue-600" />
											<span class="text-sm font-medium text-gray-700">Quick fill from online databases</span>
										</div>
										<button
											type="button"
											onclick={() => showMetadataModal = true}
											class="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
										>
											<Search class="w-3.5 h-3.5" />
											Search Metadata
										</button>
									</div>
								</div>

								<!-- Title -->
								<div>
									<label for="title" class="block text-sm font-medium text-gray-700 mb-1">Title <span class="text-red-500">*</span></label>
									<input
										id="title"
										type="text"
										bind:value={title}
										required
										class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									/>
								</div>

								<!-- Authors -->
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Authors</label>
									<div class="space-y-2 mb-2">
										{#each selectedAuthors as author, index}
											<div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border {index === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}">
												<span class="flex-1 font-medium text-sm">{author.name}</span>
												<select
													bind:value={selectedAuthors[index].role}
													class="text-xs bg-white border border-gray-200 rounded px-2 py-1"
												>
													{#each authorRoles as role}
														<option value={role}>{role}</option>
													{/each}
												</select>
												{#if index === 0}
													<span class="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Primary</span>
												{/if}
												<button type="button" onclick={() => removeAuthor(author.id)} class="p-1 text-red-500 hover:bg-red-50 rounded">
													<X class="w-4 h-4" />
												</button>
											</div>
										{/each}
									</div>
									<div class="flex gap-2">
										<div class="relative flex-1">
											<input
												type="text"
												placeholder="Search authors..."
												bind:value={authorSearch}
												onfocus={() => showAuthorDropdown = true}
												oninput={() => showAuthorDropdown = true}
												class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
											/>
											{#if showAuthorDropdown && (filteredAuthors.length > 0 || canCreateAuthor)}
												<div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
													{#each filteredAuthors as author}
														<button
															type="button"
															class="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
															onclick={() => addAuthor(author)}
														>
															{author.name}
														</button>
													{/each}
													{#if canCreateAuthor}
														<button
															type="button"
															class="w-full px-3 py-2 text-left hover:bg-green-50 text-sm border-t border-gray-100 text-green-700 font-medium flex items-center gap-2"
															onclick={createNewAuthor}
															disabled={creatingAuthor}
														>
															{#if creatingAuthor}
																<span class="animate-spin">⏳</span> Creating...
															{:else}
																<Plus class="w-4 h-4" /> Create "{authorSearch.trim()}"
															{/if}
														</button>
													{/if}
												</div>
											{/if}
										</div>
										<select bind:value={authorRole} class="px-3 py-2 border border-gray-300 rounded-lg text-sm">
											{#each authorRoles as role}
												<option value={role}>{role}</option>
											{/each}
										</select>
									</div>
									<p class="text-xs text-gray-500 mt-1">First author is primary. Drag to reorder.</p>
								</div>

								<!-- Series -->
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Series</label>
									<div class="space-y-2 mb-2">
										{#each selectedSeries as s, index}
											<div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border {index === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200'}">
												<span class="flex-1 font-medium text-sm">{s.title}</span>
												<input
													type="number"
													placeholder="Book #"
													step="0.5"
													bind:value={selectedSeries[index].bookNum}
													class="w-20 px-2 py-1 border border-gray-200 rounded text-sm bg-white"
												/>
												<span class="text-gray-400 text-sm">to</span>
												<input
													type="number"
													placeholder="End #"
													step="0.5"
													bind:value={selectedSeries[index].bookNumEnd}
													class="w-20 px-2 py-1 border border-gray-200 rounded text-sm bg-white"
												/>
												{#if index === 0}
													<span class="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Primary</span>
												{/if}
												<button type="button" onclick={() => removeSeries(s.id)} class="p-1 text-red-500 hover:bg-red-50 rounded">
													<X class="w-4 h-4" />
												</button>
											</div>
										{/each}
									</div>
									<div class="flex gap-2">
										<div class="relative flex-1">
											<input
												type="text"
												placeholder="Search series..."
												bind:value={seriesSearch}
												onfocus={() => showSeriesDropdown = true}
												oninput={() => showSeriesDropdown = true}
												class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
											/>
											{#if showSeriesDropdown && (filteredSeries.length > 0 || canCreateSeries)}
												<div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
													{#each filteredSeries as s}
														<button
															type="button"
															class="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
															onclick={() => addSeries(s)}
														>
															{s.title}
														</button>
													{/each}
													{#if canCreateSeries}
														<button
															type="button"
															class="w-full px-3 py-2 text-left hover:bg-green-50 text-sm border-t border-gray-100 text-green-700 font-medium flex items-center gap-2"
															onclick={createNewSeries}
															disabled={creatingSeries}
														>
															{#if creatingSeries}
																<span class="animate-spin">⏳</span> Creating...
															{:else}
																<Plus class="w-4 h-4" /> Create "{seriesSearch.trim()}"
															{/if}
														</button>
													{/if}
												</div>
											{/if}
										</div>
										<input
											type="number"
											placeholder="Book #"
											step="0.5"
											bind:value={seriesBookNum}
											class="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
										/>
									</div>
								</div>

								<!-- Main Details -->
								<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
									<!-- Genre with create new option -->
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Genre</label>
										{#if selectedGenre}
											<div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
												<span class="flex-1 text-sm">{selectedGenre.name}</span>
												<button type="button" onclick={clearGenre} class="p-1 text-red-500 hover:bg-red-50 rounded">
													<X class="w-4 h-4" />
												</button>
											</div>
										{:else}
											<div class="relative">
												<input
													type="text"
													placeholder="Search genres..."
													bind:value={genreSearch}
													onfocus={() => showGenreDropdown = true}
													oninput={() => showGenreDropdown = true}
													class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
												/>
												{#if showGenreDropdown && (filteredGenres.length > 0 || canCreateGenre)}
													<div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
														{#each filteredGenres as g}
															<button
																type="button"
																class="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
																onclick={() => selectGenre(g)}
															>
																{g.name}
															</button>
														{/each}
														{#if canCreateGenre}
															<button
																type="button"
																class="w-full px-3 py-2 text-left hover:bg-green-50 text-sm border-t border-gray-100 text-green-700 font-medium flex items-center gap-2"
																onclick={createNewGenre}
																disabled={creatingGenre}
															>
																{#if creatingGenre}
																	<span class="animate-spin">⏳</span> Creating...
																{:else}
																	<Plus class="w-4 h-4" /> Create "{genreSearch.trim()}"
																{/if}
															</button>
														{/if}
													</div>
												{/if}
											</div>
										{/if}
									</div>

									<div>
										<label for="formatId" class="block text-sm font-medium text-gray-700 mb-1">Format</label>
										<select id="formatId" bind:value={formatId} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
											<option value="">Select...</option>
											{#each options.formats as format}
												<option value={format.id.toString()}>{format.name}</option>
											{/each}
										</select>
									</div>

									<!-- Narrator with create new option -->
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Narrator</label>
										{#if selectedNarrator}
											<div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
												<span class="flex-1 text-sm">{selectedNarrator.name}</span>
												<button type="button" onclick={clearNarrator} class="p-1 text-red-500 hover:bg-red-50 rounded">
													<X class="w-4 h-4" />
												</button>
											</div>
										{:else}
											<div class="relative">
												<input
													type="text"
													placeholder="Search narrators..."
													bind:value={narratorSearch}
													onfocus={() => showNarratorDropdown = true}
													oninput={() => showNarratorDropdown = true}
													class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
												/>
												{#if showNarratorDropdown && (filteredNarrators.length > 0 || canCreateNarrator)}
													<div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
														{#each filteredNarrators as n}
															<button
																type="button"
																class="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
																onclick={() => selectNarrator(n)}
															>
																{n.name}
															</button>
														{/each}
														{#if canCreateNarrator}
															<button
																type="button"
																class="w-full px-3 py-2 text-left hover:bg-green-50 text-sm border-t border-gray-100 text-green-700 font-medium flex items-center gap-2"
																onclick={createNewNarrator}
																disabled={creatingNarrator}
															>
																{#if creatingNarrator}
																	<span class="animate-spin">⏳</span> Creating...
																{:else}
																	<Plus class="w-4 h-4" /> Create "{narratorSearch.trim()}"
																{/if}
															</button>
														{/if}
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</div>

								<!-- Publication Details -->
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
									<div>
										<label for="publisher" class="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
										<input id="publisher" type="text" bind:value={publisher} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
									</div>
									<div>
										<label for="publishYear" class="block text-sm font-medium text-gray-700 mb-1">Year</label>
										<input id="publishYear" type="number" min="1000" max="2100" bind:value={publishYear} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
									</div>
									<div>
										<label for="pageCount" class="block text-sm font-medium text-gray-700 mb-1">Pages</label>
										<input id="pageCount" type="number" bind:value={pageCount} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
									</div>
									<div>
										<label for="language" class="block text-sm font-medium text-gray-700 mb-1">Language</label>
										<select id="language" bind:value={language} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
											{#each languages as lang}
												<option value={lang}>{lang}</option>
											{/each}
										</select>
									</div>
								</div>

								<div class="grid grid-cols-2 gap-4">
									<div>
										<label for="edition" class="block text-sm font-medium text-gray-700 mb-1">Edition</label>
										<input id="edition" type="text" bind:value={edition} placeholder="e.g., 1st" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
									</div>
									<div>
										<label for="purchasePrice" class="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
										<input id="purchasePrice" type="number" step="0.01" bind:value={purchasePrice} placeholder="0.00" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
									</div>
								</div>
							</div>
						{/if}

						<!-- Summary Tab -->
						{#if activeTab === 'summary'}
							<div class="space-y-4">
								<div>
									<label for="summary" class="block text-sm font-medium text-gray-700 mb-1">Book Summary</label>
									<textarea
										id="summary"
										bind:value={summary}
										rows="10"
										placeholder="Enter a brief summary or description"
										class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
									></textarea>
								</div>
								<div>
									<label for="comments" class="block text-sm font-medium text-gray-700 mb-1">Personal Notes</label>
									<textarea
										id="comments"
										bind:value={comments}
										rows="5"
										placeholder="Your personal notes about this book"
										class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
									></textarea>
								</div>
							</div>
						{/if}

						<!-- Identifiers Tab -->
						{#if activeTab === 'identifiers'}
							<div class="space-y-6">
								<!-- Metadata Search -->
								<div class="p-4 border-2 border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50">
									<h3 class="font-medium text-gray-900 mb-2 flex items-center gap-2">
										<Database class="w-4 h-4 text-blue-600" />
										Metadata Lookup
									</h3>
									<p class="text-sm text-gray-600 mb-3">
										Search Google Books, Open Library, Goodreads, and Hardcover for book information
									</p>

									<button
										type="button"
										onclick={() => showMetadataModal = true}
										class="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
									>
										<Search class="w-4 h-4" />
										Search Metadata Providers
									</button>
								</div>

								<!-- Identifier Fields -->
								<div>
									<h3 class="font-medium text-gray-900 mb-3">Book Identifiers</h3>
									<div class="grid grid-cols-2 gap-4">
										<div>
											<label for="isbn13" class="block text-sm font-medium text-gray-700 mb-1">ISBN-13</label>
											<input id="isbn13" type="text" bind:value={isbn13} placeholder="978-0-00-000000-0" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
										</div>
										<div>
											<label for="isbn10" class="block text-sm font-medium text-gray-700 mb-1">ISBN-10</label>
											<input id="isbn10" type="text" bind:value={isbn10} placeholder="0-00-000000-0" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
										</div>
										<div>
											<label for="asin" class="block text-sm font-medium text-gray-700 mb-1">ASIN</label>
											<input id="asin" type="text" bind:value={asin} placeholder="B000000000" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
										</div>
										<div>
											<label for="goodreadsId" class="block text-sm font-medium text-gray-700 mb-1">Goodreads ID</label>
											<input id="goodreadsId" type="text" bind:value={goodreadsId} placeholder="12345678" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
										</div>
										<div class="col-span-2">
											<label for="googleBooksId" class="block text-sm font-medium text-gray-700 mb-1">Google Books ID</label>
											<input id="googleBooksId" type="text" bind:value={googleBooksId} placeholder="abc123xyz" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
										</div>
									</div>
								</div>
							</div>
						{/if}

						<!-- Cover Image Tab -->
						{#if activeTab === 'cover'}
							<div class="space-y-6">
								<!-- Mobile cover preview -->
								<div class="md:hidden text-center mb-4">
									<img
										src={coverPreviewUrl || '/placeholder.png'}
										alt="Cover Preview"
										class="mx-auto max-h-48 rounded-lg shadow"
										onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
									/>
								</div>

								<!-- External URL -->
								<div>
									<h3 class="font-medium text-gray-900 mb-3 flex items-center gap-2">
										<Image class="w-4 h-4" />
										External URL
									</h3>
									<p class="text-sm text-gray-600 mb-3">Enter an external image URL and download it to save locally</p>

									<div class="flex gap-2">
										<input
											type="url"
											placeholder="https://example.com/cover.jpg"
											bind:value={originalCoverUrl}
											class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
										/>
										<button
											type="button"
											onclick={downloadCover}
											disabled={downloadingCover || !originalCoverUrl}
											class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
										>
											{#if downloadingCover}
												<Loader2 class="w-4 h-4 animate-spin" />
											{:else}
												<Download class="w-4 h-4" />
											{/if}
											Download
										</button>
									</div>
									<p class="text-xs text-gray-500 mt-1">Paste URL and click download to save a local copy</p>
								</div>

								<!-- Current Status -->
								<div class="p-4 bg-gray-50 rounded-lg space-y-2">
									<h4 class="text-sm font-medium text-gray-700">Current Status</h4>
									<div class="text-sm">
										<p><span class="text-gray-500">External URL:</span> {originalCoverUrl || 'Not set'}</p>
										<p><span class="text-gray-500">Local File:</span> {coverImageUrl || 'Not downloaded'}</p>
									</div>
								</div>

								<!-- Direct URL (fallback) -->
								<div>
									<label for="coverImageUrl" class="block text-sm font-medium text-gray-700 mb-1">Local Cover Path</label>
									<input
										id="coverImageUrl"
										type="text"
										bind:value={coverImageUrl}
										placeholder="/covers/book-cover.jpg"
										class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
									/>
									<p class="text-xs text-gray-500 mt-1">Usually auto-populated after download. Can also be set manually.</p>
								</div>
							</div>
						{/if}

						<!-- Dates & Status Tab -->
						{#if activeTab === 'dates'}
							<div class="space-y-6">
								<div class="grid grid-cols-2 gap-4">
									<div>
										<label for="statusId" class="block text-sm font-medium text-gray-700 mb-1">Reading Status</label>
										<select id="statusId" bind:value={statusId} class="w-full px-3 py-2 border border-gray-300 rounded-lg">
											<option value="">Select...</option>
											{#each options.statuses as status}
												<option value={status.id.toString()}>{status.name}</option>
											{/each}
										</select>
									</div>

									<div>
										<label for="rating" class="block text-sm font-medium text-gray-700 mb-1">Rating</label>
										<input
											id="rating"
											type="number"
											min="0"
											max="5"
											step="0.5"
											bind:value={rating}
											placeholder="0-5"
											class="w-full px-3 py-2 border border-gray-300 rounded-lg"
										/>
									</div>
								</div>

								<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
									<div>
										<label for="startReadingDate" class="block text-sm font-medium text-gray-700 mb-1">Started Reading</label>
										<input id="startReadingDate" type="date" bind:value={startReadingDate} class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
									</div>
									<div>
										<label for="completedDate" class="block text-sm font-medium text-gray-700 mb-1">Completed</label>
										<input id="completedDate" type="date" bind:value={completedDate} class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
									</div>
									<div>
										<label for="releaseDate" class="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
										<input id="releaseDate" type="date" bind:value={releaseDate} class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
									</div>
								</div>

								<!-- Tags -->
								{#if options.tags.length > 0}
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-2">Tags</label>
										<div class="flex flex-wrap gap-2">
											{#each options.tags as tag}
												<button
													type="button"
													class="px-3 py-1.5 text-sm rounded-full transition-all border-2 {selectedTagIds.includes(tag.id) ? 'border-blue-500 shadow-sm' : 'border-transparent'}"
													style="background-color: {tag.color || '#6c757d'}30; color: {tag.color || '#6c757d'}"
													onclick={() => toggleTag(tag.id)}
												>
													{tag.name}
												</button>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Ebook Tab -->
						{#if activeTab === 'ebook'}
							<div class="space-y-6">
								{#if ebookPath}
									<div class="p-4 bg-green-50 border border-green-200 rounded-lg">
										<div class="flex items-center justify-between flex-wrap gap-3">
											<div class="flex items-center gap-3">
												<BookMarked class="w-6 h-6 text-green-600" />
												<div>
													<p class="font-medium text-green-900">Ebook Attached</p>
													<p class="text-sm text-green-700 break-all">{ebookPath}</p>
												</div>
											</div>
											<div class="flex gap-2">
												{#if currentMode !== 'add'}
													<a
														href="/reader/{book?.id}"
														class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
													>
														Read
													</a>
												{/if}
												<button
													type="button"
													class="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
													onclick={removeEbook}
												>
													Remove
												</button>
											</div>
										</div>
									</div>
								{:else}
									<!-- Upload zone -->
									{#if mode === 'add'}
										<div class="p-4 bg-amber-50 border border-amber-200 rounded-lg">
											<p class="text-amber-800 text-sm">
												<strong>Note:</strong> Save the book first before uploading an ebook.
											</p>
										</div>
									{:else}
										<input
											type="file"
											accept=".epub,.pdf,.cbz"
											class="hidden"
											bind:this={ebookInputRef}
											onchange={handleEbookSelect}
										/>
										<button
											type="button"
											class="w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer {ebookDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}"
											ondragover={(e) => { e.preventDefault(); ebookDragOver = true; }}
											ondragleave={() => ebookDragOver = false}
											ondrop={handleEbookDrop}
											onclick={() => ebookInputRef?.click()}
											disabled={uploadingEbook}
										>
											{#if uploadingEbook}
												<Loader2 class="w-12 h-12 text-blue-500 mx-auto mb-3 animate-spin" />
												<p class="text-blue-600 font-medium">Uploading...</p>
											{:else}
												<Tablet class="w-12 h-12 text-gray-400 mx-auto mb-3" />
												<p class="text-gray-600 mb-2 font-medium">No ebook attached</p>
												<p class="text-sm text-gray-500 mb-4">Drag and drop an ebook file here, or click to browse</p>
												<p class="text-xs text-gray-400">Supported formats: EPUB, PDF, CBZ (max 100MB)</p>
											{/if}
										</button>
									{/if}
								{/if}

								<!-- Reading progress info -->
								{#if ebookPath && book?.readingProgress}
									{@const progress = typeof book.readingProgress === 'string' ? JSON.parse(book.readingProgress) : book.readingProgress}
									<div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
										<div class="flex items-center justify-between">
											<div>
												<p class="text-sm font-medium text-blue-900">Reading Progress</p>
												<p class="text-sm text-blue-700">{progress.chapter || 'Reading...'}</p>
											</div>
											<div class="text-right">
												<p class="text-2xl font-bold text-blue-600">{Math.round(progress.percentage || 0)}%</p>
												<p class="text-xs text-blue-500">completed</p>
											</div>
										</div>
										<!-- Progress bar -->
										<div class="mt-3 h-2 bg-blue-200 rounded-full overflow-hidden">
											<div class="h-full bg-blue-600 transition-all" style="width: {progress.percentage || 0}%"></div>
										</div>
									</div>
								{/if}

								<div class="p-4 bg-gray-50 rounded-lg">
									<p class="text-sm text-gray-600">
										Upload an ebook to read it directly in BookShelf. Your reading progress will be saved automatically.
									</p>
								</div>
							</div>
						{/if}
					</div>

					<!-- Form buttons -->
					<div class="flex justify-end gap-3 p-4 border-t bg-gray-50">
						<button
							type="button"
							class="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
							onclick={() => currentMode === 'add' ? onClose() : currentMode = 'view'}
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={saving || !title.trim()}
							class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
						>
							{#if saving}
								<Loader2 class="w-4 h-4 animate-spin" />
							{/if}
							{saving ? 'Saving...' : 'Save Book'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</Modal>

<!-- Click outside handlers for dropdowns -->
{#if showAuthorDropdown || showSeriesDropdown || showNarratorDropdown || showGenreDropdown}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-10"
		onclick={() => { showAuthorDropdown = false; showSeriesDropdown = false; showNarratorDropdown = false; showGenreDropdown = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') { showAuthorDropdown = false; showSeriesDropdown = false; showNarratorDropdown = false; showGenreDropdown = false; } }}
	></div>
{/if}

<!-- Metadata Search Modal -->
<MetadataSearchModal
	open={showMetadataModal}
	initialTitle={title}
	initialAuthor={selectedAuthors[0]?.name || ''}
	initialIsbn={isbn13 || isbn10 || ''}
	onClose={() => showMetadataModal = false}
	onApply={applyMetadataResult}
/>
