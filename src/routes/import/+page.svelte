<script lang="ts">
	import { Upload, Search, BookOpen, FileText, Check, X, AlertCircle, ChevronDown, ChevronUp, Headphones, HardDrive, Loader2 } from 'lucide-svelte';

	interface ParsedBook {
		rowIndex: number;
		originalTitle: string;
		title: string;
		author: string;
		authorId: number | null;
		authorMatch: { id: number; name: string; confidence: number; exact: boolean } | null;
		series: string | null;
		seriesId: number | null;
		seriesMatch: { id: number; title: string; exact: boolean } | null;
		bookNum: number | null;
		narrator: string;
		narratorId: number | null;
		isbn: string;
		isbn13: string;
		goodreadsId: string;
		formatId: number | null;
		format: string;
		genreId: number | null;
		genre: string;
		statusId: number | null;
		status: string;
		rating: number | null;
		startDate: string;
		completedDate: string;
		releaseDate: string;
		publishYear: number | null;
		pageCount: number | null;
		publisher: string;
		summary: string;
		comments: string;
		coverUrl: string;
		isDuplicate: boolean;
		duplicateBookId: number | null;
	}

	interface LookupResult {
		title?: string;
		authors?: string[];
		publisher?: string;
		publishYear?: number;
		pageCount?: number;
		language?: string;
		summary?: string;
		isbn13?: string;
		isbn10?: string;
		coverUrl?: string;
		subjects?: string[];
		source: string;
	}

	let { data } = $props();

	interface AudibleBook {
		rowIndex: number;
		title: string;
		author: string;
		authorId: number | null;
		imageUrl: string;
		listenDate: string | null;
		asin: string;
		seriesName: string;
		seriesId: number | null;
		bookNum: number | null;
		narratorName: string;
		narratorId: number | null;
		genreId: number | null;
		formatId: number | null;
		statusId: number | null;
		isDuplicate: boolean;
		duplicateBookId: number | null;
		isRead: boolean;
	}

	// Tab state
	let activeTab = $state<'csv' | 'audible' | 'ebooks' | 'lookup'>('ebooks');

	// CSV Import state
	let csvFile = $state<File | null>(null);
	let isUploading = $state(false);
	let uploadError = $state('');
	let sessionId = $state('');
	let parsedBooks = $state<ParsedBook[]>([]);
	let selectedRows = $state<Set<number>>(new Set());
	let isGoodreads = $state(false);
	let isImporting = $state(false);
	let importResults = $state<{ imported: number; skipped: number; errors: { row: number; title: string; error: string }[] } | null>(null);

	// Lookup state
	let searchQuery = $state('');
	let searchType = $state<'isbn' | 'title'>('title');
	let isSearching = $state(false);
	let searchResults = $state<LookupResult[]>([]);
	let searchError = $state('');
	let selectedResult = $state<LookupResult | null>(null);

	// Filter/sort for CSV preview
	let showDuplicates = $state(true);
	let sortField = $state<'title' | 'author' | 'status'>('title');

	// Audible Import state
	let audibleFile = $state<File | null>(null);
	let isAudibleUploading = $state(false);
	let audibleUploadError = $state('');
	let audibleSessionId = $state('');
	let audibleBooks = $state<AudibleBook[]>([]);
	let audibleSelectedRows = $state<Set<number>>(new Set());
	let isAudibleImporting = $state(false);
	let audibleImportResults = $state<{ imported: number; skipped: number; errors: { row: number; title: string; error: string }[] } | null>(null);
	let audibleShowDuplicates = $state(true);

	// Audible dropdown options (populated from API response)
	let audibleAuthors = $state<{ id: number; name: string }[]>([]);
	let audibleSeries = $state<{ id: number; title: string }[]>([]);
	let audibleNarrators = $state<{ id: number; name: string }[]>([]);
	let audibleGenres = $state<{ id: number; name: string }[]>([]);
	let audibleFormats = $state<{ id: number; name: string }[]>([]);
	let audibleStatuses = $state<{ id: number; name: string }[]>([]);

	// Track which rows have "add new" inputs visible
	let showNewAuthor = $state<Set<number>>(new Set());
	let showNewSeries = $state<Set<number>>(new Set());
	let showNewNarrator = $state<Set<number>>(new Set());

	// File input refs
	let fileInput: HTMLInputElement;
	let audibleFileInput: HTMLInputElement;
	let ebookFileInput: HTMLInputElement;

	// Ebook Import state
	interface EbookPreview {
		index: number;
		originalFilename: string;
		format: string;
		fileSize: number;
		title: string | null;
		authors: string[];
		publisher: string | null;
		isbn: string | null;
		description: string | null;
		hasCover: boolean;
	}

	let ebookFiles = $state<File[]>([]);
	let isEbookUploading = $state(false);
	let ebookUploadError = $state('');
	let ebookSessionId = $state('');
	let ebookPreviews = $state<EbookPreview[]>([]);
	let ebookSelectedIndexes = $state<Set<number>>(new Set());
	let isEbookImporting = $state(false);
	let ebookImportResults = $state<{ imported: number; errors: { filename: string; error: string }[] } | null>(null);
	let isDragging = $state(false);

	// Editable ebook data
	let ebookEditData = $state<Record<number, { title: string; authors: string[]; publisher: string; isbn: string; description: string }>>({});

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			csvFile = input.files[0];
			uploadError = '';
		}
	}

	async function uploadCSV() {
		if (!csvFile) return;

		isUploading = true;
		uploadError = '';

		try {
			const formData = new FormData();
			formData.append('file', csvFile);

			const response = await fetch('/api/import/csv', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Upload failed');
			}

			const result = await response.json();
			sessionId = result.sessionId;
			parsedBooks = result.books;
			isGoodreads = result.isGoodreads;

			// Select all non-duplicate rows by default
			selectedRows = new Set(parsedBooks.filter(b => !b.isDuplicate).map(b => b.rowIndex));
		} catch (e) {
			uploadError = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			isUploading = false;
		}
	}

	function toggleRow(rowIndex: number) {
		const newSet = new Set(selectedRows);
		if (newSet.has(rowIndex)) {
			newSet.delete(rowIndex);
		} else {
			newSet.add(rowIndex);
		}
		selectedRows = newSet;
	}

	function selectAll() {
		selectedRows = new Set(
			parsedBooks
				.filter(b => showDuplicates || !b.isDuplicate)
				.map(b => b.rowIndex)
		);
	}

	function selectNone() {
		selectedRows = new Set();
	}

	async function executeImport() {
		if (selectedRows.size === 0 || !sessionId) return;

		isImporting = true;
		importResults = null;

		try {
			const response = await fetch('/api/import/csv', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					selectedRows: Array.from(selectedRows),
					createMissing: true
				})
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Import failed');
			}

			importResults = await response.json();
		} catch (e) {
			uploadError = e instanceof Error ? e.message : 'Import failed';
		} finally {
			isImporting = false;
		}
	}

	function resetCSVImport() {
		csvFile = null;
		sessionId = '';
		parsedBooks = [];
		selectedRows = new Set();
		importResults = null;
		uploadError = '';
		if (fileInput) fileInput.value = '';
	}

	// Audible import functions
	function handleAudibleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			audibleFile = input.files[0];
			audibleUploadError = '';
		}
	}

	async function uploadAudible() {
		if (!audibleFile) return;

		isAudibleUploading = true;
		audibleUploadError = '';

		try {
			const formData = new FormData();
			formData.append('file', audibleFile);

			const response = await fetch('/api/import/audible', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Upload failed');
			}

			const result = await response.json();
			audibleSessionId = result.sessionId;
			audibleBooks = result.books;

			// Store dropdown options
			audibleAuthors = result.authors || [];
			audibleSeries = result.series || [];
			audibleNarrators = result.narrators || [];
			audibleGenres = result.genres || [];
			audibleFormats = result.formats || [];
			audibleStatuses = result.statuses || [];

			// Select all non-duplicate rows by default
			audibleSelectedRows = new Set(audibleBooks.filter(b => !b.isDuplicate).map(b => b.rowIndex));
		} catch (e) {
			audibleUploadError = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			isAudibleUploading = false;
		}
	}

	function toggleAudibleRow(rowIndex: number) {
		const newSet = new Set(audibleSelectedRows);
		if (newSet.has(rowIndex)) {
			newSet.delete(rowIndex);
		} else {
			newSet.add(rowIndex);
		}
		audibleSelectedRows = newSet;
	}

	function selectAllAudible() {
		audibleSelectedRows = new Set(
			audibleBooks
				.filter(b => audibleShowDuplicates || !b.isDuplicate)
				.map(b => b.rowIndex)
		);
	}

	function selectNoneAudible() {
		audibleSelectedRows = new Set();
	}

	async function executeAudibleImport() {
		if (audibleSelectedRows.size === 0 || !audibleSessionId) return;

		isAudibleImporting = true;
		audibleImportResults = null;

		try {
			const response = await fetch('/api/import/audible', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: audibleSessionId,
					selectedRows: Array.from(audibleSelectedRows),
					booksData: audibleBooks.filter(b => audibleSelectedRows.has(b.rowIndex)),
					downloadCovers: true
				})
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Import failed');
			}

			audibleImportResults = await response.json();
		} catch (e) {
			audibleUploadError = e instanceof Error ? e.message : 'Import failed';
		} finally {
			isAudibleImporting = false;
		}
	}

	function resetAudibleImport() {
		audibleFile = null;
		audibleSessionId = '';
		audibleBooks = [];
		audibleSelectedRows = new Set();
		audibleImportResults = null;
		audibleUploadError = '';
		showNewAuthor = new Set();
		showNewSeries = new Set();
		showNewNarrator = new Set();
		if (audibleFileInput) audibleFileInput.value = '';
	}

	// Update a field on an Audible book
	function updateAudibleBook(rowIndex: number, field: keyof AudibleBook, value: any) {
		audibleBooks = audibleBooks.map(book => {
			if (book.rowIndex === rowIndex) {
				return { ...book, [field]: value };
			}
			return book;
		});
	}

	// Handle author select change
	function handleAuthorChange(rowIndex: number, value: string) {
		if (value === 'new') {
			showNewAuthor = new Set([...showNewAuthor, rowIndex]);
			updateAudibleBook(rowIndex, 'authorId', null);
		} else if (value === '') {
			showNewAuthor.delete(rowIndex);
			showNewAuthor = new Set(showNewAuthor);
			updateAudibleBook(rowIndex, 'authorId', null);
			updateAudibleBook(rowIndex, 'author', '');
		} else {
			showNewAuthor.delete(rowIndex);
			showNewAuthor = new Set(showNewAuthor);
			const id = parseInt(value);
			updateAudibleBook(rowIndex, 'authorId', id);
			const author = audibleAuthors.find(a => a.id === id);
			if (author) updateAudibleBook(rowIndex, 'author', author.name);
		}
	}

	// Handle series select change
	function handleSeriesChange(rowIndex: number, value: string) {
		if (value === 'new') {
			showNewSeries = new Set([...showNewSeries, rowIndex]);
			updateAudibleBook(rowIndex, 'seriesId', null);
		} else if (value === '') {
			showNewSeries.delete(rowIndex);
			showNewSeries = new Set(showNewSeries);
			updateAudibleBook(rowIndex, 'seriesId', null);
			updateAudibleBook(rowIndex, 'seriesName', '');
		} else {
			showNewSeries.delete(rowIndex);
			showNewSeries = new Set(showNewSeries);
			const id = parseInt(value);
			updateAudibleBook(rowIndex, 'seriesId', id);
			const s = audibleSeries.find(s => s.id === id);
			if (s) updateAudibleBook(rowIndex, 'seriesName', s.title);
		}
	}

	// Handle narrator select change
	function handleNarratorChange(rowIndex: number, value: string) {
		if (value === 'new') {
			showNewNarrator = new Set([...showNewNarrator, rowIndex]);
			updateAudibleBook(rowIndex, 'narratorId', null);
		} else if (value === '') {
			showNewNarrator.delete(rowIndex);
			showNewNarrator = new Set(showNewNarrator);
			updateAudibleBook(rowIndex, 'narratorId', null);
			updateAudibleBook(rowIndex, 'narratorName', '');
		} else {
			showNewNarrator.delete(rowIndex);
			showNewNarrator = new Set(showNewNarrator);
			const id = parseInt(value);
			updateAudibleBook(rowIndex, 'narratorId', id);
			const n = audibleNarrators.find(n => n.id === id);
			if (n) updateAudibleBook(rowIndex, 'narratorName', n.name);
		}
	}

	// Lookup functions
	async function searchBooks() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		searchError = '';
		searchResults = [];
		selectedResult = null;

		try {
			const params = new URLSearchParams();
			if (searchType === 'isbn') {
				params.set('isbn', searchQuery.trim());
			} else {
				params.set('query', searchQuery.trim());
			}

			const response = await fetch(`/api/import/lookup?${params}`);

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Search failed');
			}

			const result = await response.json();

			// ISBN lookup returns single result, title search returns array
			if (Array.isArray(result)) {
				searchResults = result;
			} else {
				searchResults = [result];
			}
		} catch (e) {
			searchError = e instanceof Error ? e.message : 'Search failed';
		} finally {
			isSearching = false;
		}
	}

	function selectSearchResult(result: LookupResult) {
		selectedResult = result;
	}

	// Ebook import functions
	function handleEbookDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleEbookDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	function handleEbookDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (files) {
			addEbookFiles(Array.from(files));
		}
	}

	function handleEbookFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			addEbookFiles(Array.from(input.files));
		}
	}

	function addEbookFiles(files: File[]) {
		const validExtensions = ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.cbz', '.cbr'];
		const validFiles = files.filter(f => {
			const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
			return validExtensions.includes(ext);
		});

		if (validFiles.length < files.length) {
			ebookUploadError = `Some files were skipped. Supported formats: ${validExtensions.join(', ')}`;
		} else {
			ebookUploadError = '';
		}

		ebookFiles = [...ebookFiles, ...validFiles];
	}

	function removeEbookFile(index: number) {
		ebookFiles = ebookFiles.filter((_, i) => i !== index);
	}

	async function uploadEbooks() {
		if (ebookFiles.length === 0) return;

		isEbookUploading = true;
		ebookUploadError = '';

		try {
			const formData = new FormData();
			for (const file of ebookFiles) {
				formData.append('files', file);
			}

			const response = await fetch('/api/import/ebooks', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Upload failed');
			}

			const result = await response.json();
			ebookSessionId = result.sessionId;
			ebookPreviews = result.books;

			// Initialize edit data for each book
			ebookEditData = {};
			for (const book of result.books) {
				ebookEditData[book.index] = {
					title: book.title || book.originalFilename.replace(/\.[^.]+$/, ''),
					authors: book.authors || [],
					publisher: book.publisher || '',
					isbn: book.isbn || '',
					description: book.description || ''
				};
			}

			// Select all books by default
			ebookSelectedIndexes = new Set(result.books.map((b: EbookPreview) => b.index));
		} catch (e) {
			ebookUploadError = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			isEbookUploading = false;
		}
	}

	function toggleEbookRow(index: number) {
		const newSet = new Set(ebookSelectedIndexes);
		if (newSet.has(index)) {
			newSet.delete(index);
		} else {
			newSet.add(index);
		}
		ebookSelectedIndexes = newSet;
	}

	function selectAllEbooks() {
		ebookSelectedIndexes = new Set(ebookPreviews.map(b => b.index));
	}

	function selectNoEbooks() {
		ebookSelectedIndexes = new Set();
	}

	async function executeEbookImport() {
		if (ebookSelectedIndexes.size === 0 || !ebookSessionId) return;

		isEbookImporting = true;
		ebookImportResults = null;

		try {
			const response = await fetch('/api/import/ebooks', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: ebookSessionId,
					selectedIndexes: Array.from(ebookSelectedIndexes),
					bookData: ebookEditData
				})
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Import failed');
			}

			ebookImportResults = await response.json();
		} catch (e) {
			ebookUploadError = e instanceof Error ? e.message : 'Import failed';
		} finally {
			isEbookImporting = false;
		}
	}

	function resetEbookImport() {
		// Cancel the session if it exists
		if (ebookSessionId) {
			fetch(`/api/import/ebooks?sessionId=${ebookSessionId}`, { method: 'DELETE' }).catch(() => {});
		}

		ebookFiles = [];
		ebookSessionId = '';
		ebookPreviews = [];
		ebookSelectedIndexes = new Set();
		ebookImportResults = null;
		ebookUploadError = '';
		ebookEditData = {};
		if (ebookFileInput) ebookFileInput.value = '';
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function updateEbookData(index: number, field: keyof typeof ebookEditData[number], value: string | string[]) {
		ebookEditData[index] = { ...ebookEditData[index], [field]: value };
	}

	// Filter displayed books
	let displayedBooks = $derived.by(() => {
		let books = [...parsedBooks];

		if (!showDuplicates) {
			books = books.filter(b => !b.isDuplicate);
		}

		// Sort
		books.sort((a, b) => {
			if (sortField === 'title') return a.title.localeCompare(b.title);
			if (sortField === 'author') return a.author.localeCompare(b.author);
			if (sortField === 'status') return (a.status || '').localeCompare(b.status || '');
			return 0;
		});

		return books;
	});

	let duplicateCount = $derived(parsedBooks.filter(b => b.isDuplicate).length);
	let selectedCount = $derived(selectedRows.size);
	let validSelectedCount = $derived(
		parsedBooks.filter(b => selectedRows.has(b.rowIndex) && !b.isDuplicate).length
	);

	// Audible derived values
	let displayedAudibleBooks = $derived.by(() => {
		let books = [...audibleBooks];
		if (!audibleShowDuplicates) {
			books = books.filter(b => !b.isDuplicate);
		}
		books.sort((a, b) => a.title.localeCompare(b.title));
		return books;
	});

	let audibleDuplicateCount = $derived(audibleBooks.filter(b => b.isDuplicate).length);
	let audibleValidSelectedCount = $derived(
		audibleBooks.filter(b => audibleSelectedRows.has(b.rowIndex) && !b.isDuplicate).length
	);
</script>

<svelte:head>
	<title>Import Books - BookShelf</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-6" style="color: var(--text-primary);">Import Books</h1>

	<!-- Tabs -->
	<div class="flex gap-1 mb-6 border-b" style="border-color: var(--border-color);">
		<button
			class="px-4 py-2 font-medium transition-colors rounded-t-lg"
			class:active={activeTab === 'ebooks'}
			style="color: {activeTab === 'ebooks' ? 'var(--accent)' : 'var(--text-secondary)'}; border-bottom: 2px solid {activeTab === 'ebooks' ? 'var(--accent)' : 'transparent'};"
			onclick={() => activeTab = 'ebooks'}
		>
			<HardDrive class="w-4 h-4 inline mr-2" />
			Ebooks
		</button>
		<button
			class="px-4 py-2 font-medium transition-colors rounded-t-lg"
			class:active={activeTab === 'csv'}
			style="color: {activeTab === 'csv' ? 'var(--accent)' : 'var(--text-secondary)'}; border-bottom: 2px solid {activeTab === 'csv' ? 'var(--accent)' : 'transparent'};"
			onclick={() => activeTab = 'csv'}
		>
			<FileText class="w-4 h-4 inline mr-2" />
			CSV / Goodreads
		</button>
		<button
			class="px-4 py-2 font-medium transition-colors rounded-t-lg"
			class:active={activeTab === 'audible'}
			style="color: {activeTab === 'audible' ? 'var(--accent)' : 'var(--text-secondary)'}; border-bottom: 2px solid {activeTab === 'audible' ? 'var(--accent)' : 'transparent'};"
			onclick={() => activeTab = 'audible'}
		>
			<Headphones class="w-4 h-4 inline mr-2" />
			Audible
		</button>
		<button
			class="px-4 py-2 font-medium transition-colors rounded-t-lg"
			class:active={activeTab === 'lookup'}
			style="color: {activeTab === 'lookup' ? 'var(--accent)' : 'var(--text-secondary)'}; border-bottom: 2px solid {activeTab === 'lookup' ? 'var(--accent)' : 'transparent'};"
			onclick={() => activeTab = 'lookup'}
		>
			<Search class="w-4 h-4 inline mr-2" />
			Book Lookup
		</button>
	</div>

	<!-- Ebooks Import Tab -->
	{#if activeTab === 'ebooks'}
		{#if ebookImportResults}
			<!-- Import Results -->
			<div class="rounded-xl p-6" style="background: var(--bg-secondary);">
				<h2 class="text-xl font-semibold mb-4" style="color: var(--text-primary);">
					Ebook Import Complete
				</h2>

				<div class="grid grid-cols-2 gap-4 mb-6">
					<div class="p-4 rounded-lg text-center" style="background: var(--bg-tertiary);">
						<div class="text-3xl font-bold text-green-500">{ebookImportResults.imported}</div>
						<div style="color: var(--text-secondary);">Imported</div>
					</div>
					<div class="p-4 rounded-lg text-center" style="background: var(--bg-tertiary);">
						<div class="text-3xl font-bold text-red-500">{ebookImportResults.errors.length}</div>
						<div style="color: var(--text-secondary);">Errors</div>
					</div>
				</div>

				{#if ebookImportResults.errors.length > 0}
					<div class="mb-6">
						<h3 class="font-medium mb-2" style="color: var(--text-primary);">Error Details</h3>
						<div class="max-h-48 overflow-y-auto rounded-lg" style="background: var(--bg-tertiary);">
							{#each ebookImportResults.errors as err}
								<div class="p-2 border-b" style="border-color: var(--border-color);">
									<span class="font-medium" style="color: var(--text-primary);">{err.filename}</span>
									<span style="color: var(--text-muted);">- {err.error}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="flex gap-4">
					<button
						class="px-4 py-2 rounded-lg font-medium"
						style="background: var(--accent); color: white;"
						onclick={resetEbookImport}
					>
						Import More Ebooks
					</button>
					<a
						href="/books"
						class="px-4 py-2 rounded-lg font-medium"
						style="background: var(--bg-tertiary); color: var(--text-primary);"
					>
						View Library
					</a>
				</div>
			</div>
		{:else if ebookPreviews.length > 0}
			<!-- Preview Table -->
			<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary);">
				<!-- Header -->
				<div class="p-4 border-b flex items-center justify-between" style="border-color: var(--border-color);">
					<div class="flex items-center gap-4">
						<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
							Preview ({ebookPreviews.length} ebooks)
						</h2>
					</div>
					<div class="flex items-center gap-2">
						<button
							class="px-3 py-1 text-sm rounded"
							style="background: var(--bg-tertiary); color: var(--text-secondary);"
							onclick={selectAllEbooks}
						>
							Select All
						</button>
						<button
							class="px-3 py-1 text-sm rounded"
							style="background: var(--bg-tertiary); color: var(--text-secondary);"
							onclick={selectNoEbooks}
						>
							Select None
						</button>
					</div>
				</div>

				<!-- Table -->
				<div class="max-h-[60vh] overflow-y-auto">
					<table class="w-full text-sm">
						<thead class="sticky top-0 z-10" style="background: var(--bg-tertiary);">
							<tr style="color: var(--text-secondary);">
								<th class="p-2 text-left w-10"></th>
								<th class="p-2 text-left w-14">Cover</th>
								<th class="p-2 text-left">Title</th>
								<th class="p-2 text-left">Author(s)</th>
								<th class="p-2 text-left w-20">Format</th>
								<th class="p-2 text-left w-20">Size</th>
							</tr>
						</thead>
						<tbody>
							{#each ebookPreviews as book (book.index)}
								{@const editData = ebookEditData[book.index]}
								<tr
									class="border-t align-top"
									style="border-color: var(--border-color); background: {ebookSelectedIndexes.has(book.index) ? 'var(--bg-tertiary)' : 'transparent'};"
								>
									<!-- Checkbox -->
									<td class="p-2">
										<input
											type="checkbox"
											checked={ebookSelectedIndexes.has(book.index)}
											onchange={() => toggleEbookRow(book.index)}
											class="rounded"
										/>
									</td>

									<!-- Cover -->
									<td class="p-2">
										{#if book.hasCover}
											<img
												src="/api/import/ebooks?sessionId={ebookSessionId}&index={book.index}"
												alt={book.title || 'Cover'}
												class="w-10 h-14 object-cover rounded"
												onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
											/>
										{:else}
											<div class="w-10 h-14 rounded flex items-center justify-center" style="background: var(--bg-secondary);">
												<BookOpen class="w-4 h-4" style="color: var(--text-muted);" />
											</div>
										{/if}
									</td>

									<!-- Title (editable) -->
									<td class="p-2">
										<input
											type="text"
											value={editData?.title || ''}
											oninput={(e) => updateEbookData(book.index, 'title', (e.target as HTMLInputElement).value)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										/>
										<div class="text-xs mt-1 truncate" style="color: var(--text-muted);" title={book.originalFilename}>
											{book.originalFilename}
										</div>
									</td>

									<!-- Authors (editable) -->
									<td class="p-2">
										<input
											type="text"
											value={editData?.authors?.join(', ') || ''}
											oninput={(e) => updateEbookData(book.index, 'authors', (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean))}
											placeholder="Author names (comma separated)"
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										/>
									</td>

									<!-- Format -->
									<td class="p-2">
										<span class="px-2 py-0.5 rounded text-xs font-medium uppercase" style="background: var(--bg-tertiary); color: var(--text-secondary);">
											{book.format}
										</span>
									</td>

									<!-- Size -->
									<td class="p-2" style="color: var(--text-secondary);">
										{formatFileSize(book.fileSize)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Footer -->
				<div class="p-4 border-t flex items-center justify-between" style="border-color: var(--border-color);">
					<div style="color: var(--text-secondary);">
						{ebookSelectedIndexes.size} ebooks selected for import
					</div>
					<div class="flex gap-2">
						<button
							class="px-4 py-2 rounded-lg"
							style="background: var(--bg-tertiary); color: var(--text-primary);"
							onclick={resetEbookImport}
						>
							Cancel
						</button>
						<button
							class="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
							style="background: var(--accent); color: white;"
							onclick={executeEbookImport}
							disabled={isEbookImporting || ebookSelectedIndexes.size === 0}
						>
							{#if isEbookImporting}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								<Upload class="w-4 h-4" />
							{/if}
							Import {ebookSelectedIndexes.size} Ebooks
						</button>
					</div>
				</div>
			</div>
		{:else}
			<!-- Upload Form -->
			<div class="rounded-xl p-8" style="background: var(--bg-secondary);">
				<div class="max-w-2xl mx-auto text-center">
					<div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background: var(--bg-tertiary);">
						<HardDrive class="w-8 h-8" style="color: var(--accent);" />
					</div>
					<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">
						Import Ebook Files
					</h2>
					<p class="mb-6" style="color: var(--text-secondary);">
						Drag and drop your ebook files or click to browse.
						Metadata will be automatically extracted from supported formats.
					</p>

					<input
						bind:this={ebookFileInput}
						type="file"
						accept=".epub,.pdf,.mobi,.azw,.azw3,.cbz,.cbr"
						multiple
						class="hidden"
						onchange={handleEbookFileSelect}
					/>

					<!-- Drop zone -->
					<div
						class="border-2 border-dashed rounded-xl p-8 mb-4 transition-colors cursor-pointer"
						style="border-color: {isDragging ? 'var(--accent)' : 'var(--border-color)'}; background: {isDragging ? 'var(--accent)' : 'var(--bg-tertiary)'}; opacity: {isDragging ? 0.1 : 1};"
						ondragover={handleEbookDragOver}
						ondragleave={handleEbookDragLeave}
						ondrop={handleEbookDrop}
						onclick={() => ebookFileInput?.click()}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && ebookFileInput?.click()}
					>
						{#if ebookFiles.length > 0}
							<div class="flex items-center justify-center gap-2" style="color: var(--text-primary);">
								<Check class="w-5 h-5 text-green-500" />
								{ebookFiles.length} file{ebookFiles.length !== 1 ? 's' : ''} selected
							</div>
						{:else}
							<Upload class="w-8 h-8 mx-auto mb-2" style="color: var(--text-muted);" />
							<p style="color: var(--text-muted);">
								Drop ebook files here or click to browse
							</p>
							<p class="text-xs mt-2" style="color: var(--text-muted);">
								Supports: EPUB, PDF, MOBI, AZW, AZW3, CBZ, CBR
							</p>
						{/if}
					</div>

					<!-- File list -->
					{#if ebookFiles.length > 0}
						<div class="mb-4 max-h-48 overflow-y-auto rounded-lg" style="background: var(--bg-tertiary);">
							{#each ebookFiles as file, index}
								<div class="flex items-center justify-between p-2 border-b" style="border-color: var(--border-color);">
									<div class="flex items-center gap-2 min-w-0">
										<BookOpen class="w-4 h-4 flex-shrink-0" style="color: var(--text-muted);" />
										<span class="truncate" style="color: var(--text-primary);">{file.name}</span>
										<span class="text-xs" style="color: var(--text-muted);">({formatFileSize(file.size)})</span>
									</div>
									<button
										class="p-1 rounded hover:bg-red-500/20"
										onclick={() => removeEbookFile(index)}
									>
										<X class="w-4 h-4 text-red-500" />
									</button>
								</div>
							{/each}
						</div>
					{/if}

					{#if ebookUploadError}
						<div class="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
							{ebookUploadError}
						</div>
					{/if}

					<button
						class="px-6 py-2 rounded-lg font-medium flex items-center gap-2 mx-auto"
						style="background: var(--accent); color: white;"
						onclick={uploadEbooks}
						disabled={ebookFiles.length === 0 || isEbookUploading}
					>
						{#if isEbookUploading}
							<Loader2 class="w-4 h-4 animate-spin" />
							Extracting metadata...
						{:else}
							<Upload class="w-4 h-4" />
							Upload & Preview
						{/if}
					</button>
				</div>
			</div>
		{/if}
	{/if}

	<!-- CSV Import Tab -->
	{#if activeTab === 'csv'}
		{#if importResults}
			<!-- Import Results -->
			<div class="rounded-xl p-6" style="background: var(--bg-secondary);">
				<h2 class="text-xl font-semibold mb-4" style="color: var(--text-primary);">
					Import Complete
				</h2>

				<div class="grid grid-cols-3 gap-4 mb-6">
					<div class="p-4 rounded-lg text-center" style="background: var(--bg-tertiary);">
						<div class="text-3xl font-bold text-green-500">{importResults.imported}</div>
						<div style="color: var(--text-secondary);">Imported</div>
					</div>
					<div class="p-4 rounded-lg text-center" style="background: var(--bg-tertiary);">
						<div class="text-3xl font-bold text-yellow-500">{parsedBooks.length - importResults.imported - importResults.errors.length}</div>
						<div style="color: var(--text-secondary);">Skipped</div>
					</div>
					<div class="p-4 rounded-lg text-center" style="background: var(--bg-tertiary);">
						<div class="text-3xl font-bold text-red-500">{importResults.errors.length}</div>
						<div style="color: var(--text-secondary);">Errors</div>
					</div>
				</div>

				{#if importResults.errors.length > 0}
					<div class="mb-6">
						<h3 class="font-medium mb-2" style="color: var(--text-primary);">Error Details</h3>
						<div class="max-h-48 overflow-y-auto rounded-lg" style="background: var(--bg-tertiary);">
							{#each importResults.errors as err}
								<div class="p-2 border-b" style="border-color: var(--border-color);">
									<span class="font-medium" style="color: var(--text-primary);">{err.title}</span>
									<span style="color: var(--text-muted);">- {err.error}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="flex gap-4">
					<button
						class="px-4 py-2 rounded-lg font-medium"
						style="background: var(--accent); color: white;"
						onclick={resetCSVImport}
					>
						Import More Books
					</button>
					<a
						href="/books"
						class="px-4 py-2 rounded-lg font-medium"
						style="background: var(--bg-tertiary); color: var(--text-primary);"
					>
						View Library
					</a>
				</div>
			</div>
		{:else if parsedBooks.length > 0}
			<!-- Preview Table -->
			<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary);">
				<!-- Header -->
				<div class="p-4 border-b flex items-center justify-between" style="border-color: var(--border-color);">
					<div class="flex items-center gap-4">
						<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
							Preview ({displayedBooks.length} books)
							{#if isGoodreads}
								<span class="ml-2 text-sm px-2 py-0.5 rounded" style="background: var(--accent); color: white;">
									Goodreads Format
								</span>
							{/if}
						</h2>
						{#if duplicateCount > 0}
							<label class="flex items-center gap-2 text-sm" style="color: var(--text-secondary);">
								<input type="checkbox" bind:checked={showDuplicates} class="rounded" />
								Show duplicates ({duplicateCount})
							</label>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<button
							class="px-3 py-1 text-sm rounded"
							style="background: var(--bg-tertiary); color: var(--text-secondary);"
							onclick={selectAll}
						>
							Select All
						</button>
						<button
							class="px-3 py-1 text-sm rounded"
							style="background: var(--bg-tertiary); color: var(--text-secondary);"
							onclick={selectNone}
						>
							Select None
						</button>
					</div>
				</div>

				<!-- Table -->
				<div class="max-h-[60vh] overflow-y-auto">
					<table class="w-full text-sm">
						<thead class="sticky top-0" style="background: var(--bg-tertiary);">
							<tr style="color: var(--text-secondary);">
								<th class="p-2 text-left w-10"></th>
								<th class="p-2 text-left">Title</th>
								<th class="p-2 text-left">Author</th>
								<th class="p-2 text-left">Series</th>
								<th class="p-2 text-left">Status</th>
								<th class="p-2 text-center w-20">Rating</th>
							</tr>
						</thead>
						<tbody>
							{#each displayedBooks as book (book.rowIndex)}
								<tr
									class="border-t transition-colors cursor-pointer"
									style="border-color: var(--border-color); background: {selectedRows.has(book.rowIndex) ? 'var(--bg-tertiary)' : 'transparent'};"
									class:opacity-50={book.isDuplicate}
									onclick={() => toggleRow(book.rowIndex)}
								>
									<td class="p-2">
										<input
											type="checkbox"
											checked={selectedRows.has(book.rowIndex)}
											onclick={(e) => e.stopPropagation()}
											onchange={() => toggleRow(book.rowIndex)}
											class="rounded"
										/>
									</td>
									<td class="p-2">
										<div style="color: var(--text-primary);">{book.title}</div>
										{#if book.isDuplicate}
											<div class="text-xs text-orange-500 flex items-center gap-1">
												<AlertCircle class="w-3 h-3" />
												Already in library
											</div>
										{/if}
									</td>
									<td class="p-2">
										<div style="color: var(--text-primary);">{book.author}</div>
										{#if book.authorMatch && !book.authorMatch.exact}
											<div class="text-xs" style="color: var(--text-muted);">
												Match: {book.authorMatch.name} ({book.authorMatch.confidence}%)
											</div>
										{/if}
									</td>
									<td class="p-2" style="color: var(--text-secondary);">
										{#if book.series}
											{book.series}
											{#if book.bookNum}
												#{book.bookNum}
											{/if}
										{:else}
											-
										{/if}
									</td>
									<td class="p-2" style="color: var(--text-secondary);">
										{book.status || '-'}
									</td>
									<td class="p-2 text-center" style="color: var(--text-secondary);">
										{book.rating || '-'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Footer -->
				<div class="p-4 border-t flex items-center justify-between" style="border-color: var(--border-color);">
					<div style="color: var(--text-secondary);">
						{validSelectedCount} books selected for import
					</div>
					<div class="flex gap-2">
						<button
							class="px-4 py-2 rounded-lg"
							style="background: var(--bg-tertiary); color: var(--text-primary);"
							onclick={resetCSVImport}
						>
							Cancel
						</button>
						<button
							class="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
							style="background: var(--accent); color: white;"
							onclick={executeImport}
							disabled={isImporting || validSelectedCount === 0}
						>
							{#if isImporting}
								<span class="animate-spin">...</span>
							{:else}
								<Upload class="w-4 h-4" />
							{/if}
							Import {validSelectedCount} Books
						</button>
					</div>
				</div>
			</div>
		{:else}
			<!-- Upload Form -->
			<div class="rounded-xl p-8" style="background: var(--bg-secondary);">
				<div class="max-w-lg mx-auto text-center">
					<div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background: var(--bg-tertiary);">
						<FileText class="w-8 h-8" style="color: var(--accent);" />
					</div>
					<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">
						Import from CSV
					</h2>
					<p class="mb-6" style="color: var(--text-secondary);">
						Upload a CSV file or Goodreads export to import your books.
						Goodreads format is automatically detected.
					</p>

					<input
						bind:this={fileInput}
						type="file"
						accept=".csv"
						class="hidden"
						onchange={handleFileSelect}
					/>

					<div
						class="border-2 border-dashed rounded-xl p-8 mb-4 transition-colors cursor-pointer"
						style="border-color: var(--border-color); background: var(--bg-tertiary);"
						onclick={() => fileInput?.click()}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
					>
						{#if csvFile}
							<div class="flex items-center justify-center gap-2" style="color: var(--text-primary);">
								<Check class="w-5 h-5 text-green-500" />
								{csvFile.name}
							</div>
						{:else}
							<Upload class="w-8 h-8 mx-auto mb-2" style="color: var(--text-muted);" />
							<p style="color: var(--text-muted);">
								Click or drag to upload CSV file
							</p>
						{/if}
					</div>

					{#if uploadError}
						<div class="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
							{uploadError}
						</div>
					{/if}

					<button
						class="px-6 py-2 rounded-lg font-medium"
						style="background: var(--accent); color: white;"
						onclick={uploadCSV}
						disabled={!csvFile || isUploading}
					>
						{#if isUploading}
							Parsing...
						{:else}
							Upload & Preview
						{/if}
					</button>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Audible Import Tab -->
	{#if activeTab === 'audible'}
		{#if audibleImportResults}
			<!-- Import Results -->
			<div class="rounded-xl p-6" style="background: var(--bg-secondary);">
				<h2 class="text-xl font-semibold mb-4" style="color: var(--text-primary);">
					Audible Import Complete
				</h2>

				<div class="grid grid-cols-3 gap-4 mb-6">
					<div class="p-4 rounded-lg text-center" style="background: var(--bg-tertiary);">
						<div class="text-3xl font-bold text-green-500">{audibleImportResults.imported}</div>
						<div style="color: var(--text-secondary);">Imported</div>
					</div>
					<div class="p-4 rounded-lg text-center" style="background: var(--bg-tertiary);">
						<div class="text-3xl font-bold text-yellow-500">{audibleBooks.length - audibleImportResults.imported - audibleImportResults.errors.length}</div>
						<div style="color: var(--text-secondary);">Skipped</div>
					</div>
					<div class="p-4 rounded-lg text-center" style="background: var(--bg-tertiary);">
						<div class="text-3xl font-bold text-red-500">{audibleImportResults.errors.length}</div>
						<div style="color: var(--text-secondary);">Errors</div>
					</div>
				</div>

				{#if audibleImportResults.errors.length > 0}
					<div class="mb-6">
						<h3 class="font-medium mb-2" style="color: var(--text-primary);">Error Details</h3>
						<div class="max-h-48 overflow-y-auto rounded-lg" style="background: var(--bg-tertiary);">
							{#each audibleImportResults.errors as err}
								<div class="p-2 border-b" style="border-color: var(--border-color);">
									<span class="font-medium" style="color: var(--text-primary);">{err.title}</span>
									<span style="color: var(--text-muted);">- {err.error}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="flex gap-4">
					<button
						class="px-4 py-2 rounded-lg font-medium"
						style="background: var(--accent); color: white;"
						onclick={resetAudibleImport}
					>
						Import More Books
					</button>
					<a
						href="/books"
						class="px-4 py-2 rounded-lg font-medium"
						style="background: var(--bg-tertiary); color: var(--text-primary);"
					>
						View Library
					</a>
				</div>
			</div>
		{:else if audibleBooks.length > 0}
			<!-- Preview Table -->
			<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary);">
				<!-- Header -->
				<div class="p-4 border-b flex items-center justify-between" style="border-color: var(--border-color);">
					<div class="flex items-center gap-4">
						<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
							Preview ({displayedAudibleBooks.length} audiobooks)
							<span class="ml-2 text-sm px-2 py-0.5 rounded" style="background: #ff9900; color: white;">
								Audible
							</span>
						</h2>
						{#if audibleDuplicateCount > 0}
							<label class="flex items-center gap-2 text-sm" style="color: var(--text-secondary);">
								<input type="checkbox" bind:checked={audibleShowDuplicates} class="rounded" />
								Show duplicates ({audibleDuplicateCount})
							</label>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<button
							class="px-3 py-1 text-sm rounded"
							style="background: var(--bg-tertiary); color: var(--text-secondary);"
							onclick={selectAllAudible}
						>
							Select All
						</button>
						<button
							class="px-3 py-1 text-sm rounded"
							style="background: var(--bg-tertiary); color: var(--text-secondary);"
							onclick={selectNoneAudible}
						>
							Select None
						</button>
					</div>
				</div>

				<!-- Editable Table -->
				<div class="max-h-[70vh] overflow-y-auto">
					<table class="w-full text-sm">
						<thead class="sticky top-0 z-10" style="background: var(--bg-tertiary);">
							<tr style="color: var(--text-secondary);">
								<th class="p-2 text-left w-10"></th>
								<th class="p-2 text-left w-14">Cover</th>
								<th class="p-2 text-left min-w-[200px]">Title</th>
								<th class="p-2 text-left min-w-[150px]">Author</th>
								<th class="p-2 text-left min-w-[150px]">Series</th>
								<th class="p-2 text-left w-16">#</th>
								<th class="p-2 text-left min-w-[150px]">Narrator</th>
								<th class="p-2 text-left w-28">Genre</th>
								<th class="p-2 text-left w-28">Format</th>
								<th class="p-2 text-left w-28">Status</th>
								<th class="p-2 text-left w-32">Completed</th>
							</tr>
						</thead>
						<tbody>
							{#each displayedAudibleBooks as book (book.rowIndex)}
								<tr
									class="border-t align-top"
									style="border-color: var(--border-color); background: {audibleSelectedRows.has(book.rowIndex) ? 'var(--bg-tertiary)' : 'transparent'};"
									class:opacity-50={book.isDuplicate}
								>
									<!-- Checkbox -->
									<td class="p-2">
										<input
											type="checkbox"
											checked={audibleSelectedRows.has(book.rowIndex)}
											onchange={() => toggleAudibleRow(book.rowIndex)}
											class="rounded"
										/>
									</td>

									<!-- Cover -->
									<td class="p-2">
										{#if book.imageUrl}
											<img
												src={book.imageUrl}
												alt={book.title}
												class="w-10 h-14 object-cover rounded"
												onerror={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
											/>
										{:else}
											<div class="w-10 h-14 rounded flex items-center justify-center" style="background: var(--bg-secondary);">
												<Headphones class="w-4 h-4" style="color: var(--text-muted);" />
											</div>
										{/if}
									</td>

									<!-- Title (editable input) -->
									<td class="p-2">
										<input
											type="text"
											value={book.title}
											onchange={(e) => updateAudibleBook(book.rowIndex, 'title', (e.target as HTMLInputElement).value)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										/>
										{#if book.isDuplicate}
											<div class="text-xs text-orange-500 flex items-center gap-1 mt-1">
												<AlertCircle class="w-3 h-3" />
												Already in library
											</div>
										{/if}
										{#if book.asin}
											<div class="text-xs mt-1" style="color: var(--text-muted);">
												ASIN: {book.asin}
											</div>
										{/if}
									</td>

									<!-- Author (select with add new) -->
									<td class="p-2">
										<select
											value={book.authorId?.toString() || (showNewAuthor.has(book.rowIndex) ? 'new' : '')}
											onchange={(e) => handleAuthorChange(book.rowIndex, (e.target as HTMLSelectElement).value)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										>
											<option value="">-- Select --</option>
											<option value="new">+ Add new...</option>
											{#each audibleAuthors as author}
												<option value={author.id.toString()}>{author.name}</option>
											{/each}
										</select>
										{#if showNewAuthor.has(book.rowIndex)}
											<input
												type="text"
												value={book.author}
												onchange={(e) => updateAudibleBook(book.rowIndex, 'author', (e.target as HTMLInputElement).value)}
												placeholder="New author name"
												class="w-full px-2 py-1 rounded text-sm mt-1"
												style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
											/>
										{:else if !book.authorId && book.author}
											<div class="text-xs mt-1" style="color: var(--text-muted);">
												From file: {book.author}
											</div>
										{/if}
									</td>

									<!-- Series (select with add new) -->
									<td class="p-2">
										<select
											value={book.seriesId?.toString() || (showNewSeries.has(book.rowIndex) ? 'new' : '')}
											onchange={(e) => handleSeriesChange(book.rowIndex, (e.target as HTMLSelectElement).value)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										>
											<option value="">-- None --</option>
											<option value="new">+ Add new...</option>
											{#each audibleSeries as s}
												<option value={s.id.toString()}>{s.title}</option>
											{/each}
										</select>
										{#if showNewSeries.has(book.rowIndex)}
											<input
												type="text"
												value={book.seriesName}
												onchange={(e) => updateAudibleBook(book.rowIndex, 'seriesName', (e.target as HTMLInputElement).value)}
												placeholder="New series name"
												class="w-full px-2 py-1 rounded text-sm mt-1"
												style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
											/>
										{/if}
									</td>

									<!-- Book Number -->
									<td class="p-2">
										<input
											type="number"
											value={book.bookNum || ''}
											onchange={(e) => updateAudibleBook(book.rowIndex, 'bookNum', (e.target as HTMLInputElement).value ? parseFloat((e.target as HTMLInputElement).value) : null)}
											placeholder="#"
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										/>
									</td>

									<!-- Narrator (select with add new) -->
									<td class="p-2">
										<select
											value={book.narratorId?.toString() || (showNewNarrator.has(book.rowIndex) ? 'new' : '')}
											onchange={(e) => handleNarratorChange(book.rowIndex, (e.target as HTMLSelectElement).value)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										>
											<option value="">-- None --</option>
											<option value="new">+ Add new...</option>
											{#each audibleNarrators as narrator}
												<option value={narrator.id.toString()}>{narrator.name}</option>
											{/each}
										</select>
										{#if showNewNarrator.has(book.rowIndex)}
											<input
												type="text"
												value={book.narratorName}
												onchange={(e) => updateAudibleBook(book.rowIndex, 'narratorName', (e.target as HTMLInputElement).value)}
												placeholder="New narrator name"
												class="w-full px-2 py-1 rounded text-sm mt-1"
												style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
											/>
										{/if}
									</td>

									<!-- Genre -->
									<td class="p-2">
										<select
											value={book.genreId?.toString() || ''}
											onchange={(e) => updateAudibleBook(book.rowIndex, 'genreId', (e.target as HTMLSelectElement).value ? parseInt((e.target as HTMLSelectElement).value) : null)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										>
											<option value="">-- None --</option>
											{#each audibleGenres as genre}
												<option value={genre.id.toString()}>{genre.name}</option>
											{/each}
										</select>
									</td>

									<!-- Format -->
									<td class="p-2">
										<select
											value={book.formatId?.toString() || ''}
											onchange={(e) => updateAudibleBook(book.rowIndex, 'formatId', (e.target as HTMLSelectElement).value ? parseInt((e.target as HTMLSelectElement).value) : null)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										>
											<option value="">-- None --</option>
											{#each audibleFormats as format}
												<option value={format.id.toString()}>{format.name}</option>
											{/each}
										</select>
									</td>

									<!-- Status -->
									<td class="p-2">
										<select
											value={book.statusId?.toString() || ''}
											onchange={(e) => updateAudibleBook(book.rowIndex, 'statusId', (e.target as HTMLSelectElement).value ? parseInt((e.target as HTMLSelectElement).value) : null)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										>
											<option value="">-- None --</option>
											{#each audibleStatuses as status}
												<option value={status.id.toString()}>{status.name}</option>
											{/each}
										</select>
									</td>

									<!-- Completed Date -->
									<td class="p-2">
										<input
											type="date"
											value={book.listenDate || ''}
											onchange={(e) => updateAudibleBook(book.rowIndex, 'listenDate', (e.target as HTMLInputElement).value || null)}
											class="w-full px-2 py-1 rounded text-sm"
											style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Footer -->
				<div class="p-4 border-t flex items-center justify-between" style="border-color: var(--border-color);">
					<div style="color: var(--text-secondary);">
						{audibleValidSelectedCount} audiobooks selected for import
					</div>
					<div class="flex gap-2">
						<button
							class="px-4 py-2 rounded-lg"
							style="background: var(--bg-tertiary); color: var(--text-primary);"
							onclick={resetAudibleImport}
						>
							Cancel
						</button>
						<button
							class="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
							style="background: #ff9900; color: white;"
							onclick={executeAudibleImport}
							disabled={isAudibleImporting || audibleValidSelectedCount === 0}
						>
							{#if isAudibleImporting}
								<span class="animate-spin">...</span>
							{:else}
								<Upload class="w-4 h-4" />
							{/if}
							Import {audibleValidSelectedCount} Audiobooks
						</button>
					</div>
				</div>
			</div>
		{:else}
			<!-- Upload Form -->
			<div class="rounded-xl p-8" style="background: var(--bg-secondary);">
				<div class="max-w-lg mx-auto text-center">
					<div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background: #ff9900;">
						<Headphones class="w-8 h-8 text-white" />
					</div>
					<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">
						Import from Audible
					</h2>
					<p class="mb-6" style="color: var(--text-secondary);">
						Export your Audible listening history page as HTML and upload it here.
						Books will be imported with Audiobook format automatically.
					</p>

					<div class="mb-4 p-4 rounded-lg text-left" style="background: var(--bg-tertiary);">
						<h3 class="font-medium mb-2" style="color: var(--text-primary);">How to export from Audible:</h3>
						<ol class="text-sm space-y-1" style="color: var(--text-secondary);">
							<li>1. Go to <a href="https://www.audible.com/library/listening-history" target="_blank" rel="noopener" class="underline" style="color: var(--accent);">audible.com/library/listening-history</a></li>
							<li>2. Scroll to load all your books</li>
							<li>3. Right-click and select "Save As..." or Ctrl+S</li>
							<li>4. Save as "Webpage, Complete" or "HTML only"</li>
							<li>5. Upload the saved .html file below</li>
						</ol>
					</div>

					<input
						bind:this={audibleFileInput}
						type="file"
						accept=".html,.htm"
						class="hidden"
						onchange={handleAudibleFileSelect}
					/>

					<div
						class="border-2 border-dashed rounded-xl p-8 mb-4 transition-colors cursor-pointer"
						style="border-color: var(--border-color); background: var(--bg-tertiary);"
						onclick={() => audibleFileInput?.click()}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && audibleFileInput?.click()}
					>
						{#if audibleFile}
							<div class="flex items-center justify-center gap-2" style="color: var(--text-primary);">
								<Check class="w-5 h-5 text-green-500" />
								{audibleFile.name}
							</div>
						{:else}
							<Upload class="w-8 h-8 mx-auto mb-2" style="color: var(--text-muted);" />
							<p style="color: var(--text-muted);">
								Click or drag to upload HTML file
							</p>
						{/if}
					</div>

					{#if audibleUploadError}
						<div class="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
							{audibleUploadError}
						</div>
					{/if}

					<button
						class="px-6 py-2 rounded-lg font-medium"
						style="background: #ff9900; color: white;"
						onclick={uploadAudible}
						disabled={!audibleFile || isAudibleUploading}
					>
						{#if isAudibleUploading}
							Parsing...
						{:else}
							Upload & Preview
						{/if}
					</button>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Book Lookup Tab -->
	{#if activeTab === 'lookup'}
		<div class="rounded-xl p-6" style="background: var(--bg-secondary);">
			<div class="max-w-2xl mx-auto">
				<!-- Search Form -->
				<div class="flex gap-2 mb-6">
					<select
						bind:value={searchType}
						class="px-3 py-2 rounded-lg"
						style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
					>
						<option value="title">Title/Author</option>
						<option value="isbn">ISBN</option>
					</select>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder={searchType === 'isbn' ? 'Enter ISBN...' : 'Search by title or author...'}
						class="flex-1 px-4 py-2 rounded-lg"
						style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
						onkeydown={(e) => e.key === 'Enter' && searchBooks()}
					/>
					<button
						class="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
						style="background: var(--accent); color: white;"
						onclick={searchBooks}
						disabled={isSearching || !searchQuery.trim()}
					>
						{#if isSearching}
							<span class="animate-spin">...</span>
						{:else}
							<Search class="w-4 h-4" />
						{/if}
						Search
					</button>
				</div>

				{#if searchError}
					<div class="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm mb-4">
						{searchError}
					</div>
				{/if}

				<!-- Search Results -->
				{#if searchResults.length > 0}
					<div class="space-y-3">
						<h3 class="font-medium" style="color: var(--text-primary);">
							{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
						</h3>
						{#each searchResults as result}
							<button
								class="w-full text-left p-4 rounded-lg border transition-colors"
								style="background: {selectedResult === result ? 'var(--bg-tertiary)' : 'var(--bg-secondary)'}; border-color: {selectedResult === result ? 'var(--accent)' : 'var(--border-color)'};"
								onclick={() => selectSearchResult(result)}
							>
								<div class="flex gap-4">
									{#if result.coverUrl}
										<img
											src={result.coverUrl}
											alt={result.title}
											class="w-16 h-24 object-cover rounded"
										/>
									{:else}
										<div class="w-16 h-24 rounded flex items-center justify-center" style="background: var(--bg-tertiary);">
											<BookOpen class="w-6 h-6" style="color: var(--text-muted);" />
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium" style="color: var(--text-primary);">
											{result.title || 'Unknown Title'}
										</div>
										<div class="text-sm" style="color: var(--text-secondary);">
											{result.authors?.join(', ') || 'Unknown Author'}
										</div>
										<div class="text-xs mt-1" style="color: var(--text-muted);">
											{#if result.publishYear}
												{result.publishYear}
											{/if}
											{#if result.publisher}
												{result.publishYear ? ' - ' : ''}{result.publisher}
											{/if}
											{#if result.pageCount}
												{result.publishYear || result.publisher ? ' - ' : ''}{result.pageCount} pages
											{/if}
										</div>
										<div class="text-xs mt-1" style="color: var(--text-muted);">
											{#if result.isbn13}
												ISBN: {result.isbn13}
											{:else if result.isbn10}
												ISBN: {result.isbn10}
											{/if}
											<span class="ml-2 px-1 py-0.5 rounded text-xs" style="background: var(--bg-tertiary);">
												{result.source}
											</span>
										</div>
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Selected Result Actions -->
				{#if selectedResult}
					<div class="mt-6 p-4 rounded-lg" style="background: var(--bg-tertiary);">
						<h3 class="font-medium mb-3" style="color: var(--text-primary);">
							Add "{selectedResult.title}" to library?
						</h3>
						<a
							href="/books/new?title={encodeURIComponent(selectedResult.title || '')}&author={encodeURIComponent(selectedResult.authors?.join(', ') || '')}&isbn={encodeURIComponent(selectedResult.isbn13 || selectedResult.isbn10 || '')}&coverUrl={encodeURIComponent(selectedResult.coverUrl || '')}&publisher={encodeURIComponent(selectedResult.publisher || '')}&pageCount={selectedResult.pageCount || ''}&publishYear={selectedResult.publishYear || ''}"
							class="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
							style="background: var(--accent); color: white;"
						>
							<BookOpen class="w-4 h-4" />
							Add to Library
						</a>
					</div>
				{/if}

				<!-- Empty State -->
				{#if !isSearching && searchResults.length === 0 && !searchError}
					<div class="text-center py-8" style="color: var(--text-muted);">
						<Search class="w-12 h-12 mx-auto mb-3 opacity-50" />
						<p>Search for a book by ISBN or title to add it to your library.</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
