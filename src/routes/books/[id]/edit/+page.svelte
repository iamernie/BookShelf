<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import {
		ArrowLeft,
		BookOpen,
		Info,
		AlignLeft,
		Fingerprint,
		Image,
		CalendarDays,
		Tablet,
		X,
		Star,
		BookMarked,
		Search,
		Loader2,
		Download,
		Plus,
		Minus,
		ChevronRight,
		Library,
		Database,
		Music,
		Headphones
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import { toInputDate } from '$lib/utils/date';
	import MetadataSearchModal from '$lib/components/book/MetadataSearchModal.svelte';
	import AbsLinkSection from '$lib/components/audiobook/AbsLinkSection.svelte';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';

	let { data } = $props();
	const book = data.book;
	const options = data.options;

	let saving = $state(false);

	// Get initial tab from URL query param
	const urlTab = $page.url.searchParams.get('tab');
	const validTabs = ['basic', 'summary', 'identifiers', 'cover', 'dates', 'media'] as const;
	const initialTab = urlTab && validTabs.includes(urlTab as any) ? urlTab as typeof validTabs[number] : 'basic';
	let activeTab = $state<typeof validTabs[number]>(initialTab);

	// Form fields
	let title = $state(book.title || '');
	let summary = $state(book.summary || '');
	let comments = $state(book.comments || '');
	let rating = $state(book.rating?.toString() || '');
	let providerRating = $state(book.providerRating?.toString() || '');
	let providerRatingSource = $state(book.providerRatingSource || '');
	let providerRatingCount = $state(book.providerRatingCount?.toString() || '');
	let coverImageUrl = $state(book.coverImageUrl || '');
	let originalCoverUrl = $state(book.originalCoverUrl || '');
	let statusId = $state(book.statusId?.toString() || '');
	let genreId = $state(book.genreId?.toString() || '');
	let formatId = $state(book.formatId?.toString() || '');
	let releaseDate = $state(toInputDate(book.releaseDate));
	let startReadingDate = $state(toInputDate(book.startReadingDate));
	let completedDate = $state(toInputDate(book.completedDate));
	let isbn10 = $state(book.isbn10 || '');
	let isbn13 = $state(book.isbn13 || '');
	let asin = $state(book.asin || '');
	let goodreadsId = $state(book.goodreadsId || '');
	let googleBooksId = $state(book.googleBooksId || '');
	let pageCount = $state(book.pageCount?.toString() || '');
	let publisher = $state(book.publisher || '');
	let publishYear = $state(book.publishYear?.toString() || '');
	let edition = $state(book.edition || '');
	let language = $state(book.language || 'English');
	let purchasePrice = $state(book.purchasePrice?.toString() || '');
	let ebookPath = $state(book.ebookPath || '');

	// Cover/lookup state
	let downloadingCover = $state(false);
	let lookupLoading = $state(false);
	let lookupIsbn = $state('');
	let coverPreviewUrl = $derived(coverImageUrl || originalCoverUrl || '');

	// Metadata search modal
	let showMetadataModal = $state(false);

	// Ebook upload state
	let uploadingEbook = $state(false);
	let ebookDragOver = $state(false);
	let ebookInputRef = $state<HTMLInputElement | null>(null);

	// Relations
	let selectedAuthors = $state<{ id: number; name: string; role: string }[]>(
		book.authors?.map((a: any) => ({ id: a.id, name: a.name, role: a.role || 'Author' })) || []
	);
	let selectedSeries = $state<{ id: number; title: string; bookNum: string; bookNumEnd: string; isOmnibus: boolean }[]>(
		book.series?.map((s: any) => ({
			id: s.id,
			title: s.title,
			bookNum: s.bookNum?.toString() || '',
			bookNumEnd: s.bookNumEnd?.toString() || '',
			isOmnibus: !!s.bookNumEnd
		})) || []
	);
	let selectedTagIds = $state<number[]>(book.tags?.map((t: any) => t.id) || []);
	let selectedMediaSourceIds = $state<number[]>(data.bookMediaSources?.map((bms: any) => bms.mediaSourceId) || []);
	let availableMediaSources = $state(options.mediaSources || []);

	// Custom media source creation state
	let showAddSourceModal = $state(false);
	let newSourceName = $state('');
	let newSourceIcon = $state('shopping-bag');
	let newSourceColor = $state('#6c757d');
	let creatingSource = $state(false);
	const sourceIcons = ['shopping-bag', 'headphones', 'tablet', 'book', 'book-open', 'smartphone', 'library', 'play', 'music'];
	const sourceColors = ['#f7971e', '#ff9900', '#8b4513', '#bf0811', '#000000', '#4285f4', '#2e7d32', '#f5a623', '#6c757d', '#e91e63', '#9c27b0', '#3f51b5'];

	// Author picker state
	let authorSearch = $state('');
	let authorRole = $state('Author');
	let showAuthorDropdown = $state(false);
	let availableAuthors = $state<{ id: number; name: string }[]>(options.authors);
	let availableGenres = $state<{ id: number; name: string }[]>(options.genres);
	let filteredAuthors = $derived(
		availableAuthors.filter((a: any) =>
			a.name.toLowerCase().includes(authorSearch.toLowerCase()) &&
			!selectedAuthors.some(sa => sa.id === a.id)
		).slice(0, 10)
	);

	// Series picker state
	let seriesSearch = $state('');
	let seriesBookNum = $state('');
	let showSeriesDropdown = $state(false);
	let creatingSeries = $state(false);
	let availableSeries = $state(options.series);
	let filteredSeries = $derived(
		availableSeries.filter((s: any) =>
			s.title.toLowerCase().includes(seriesSearch.toLowerCase()) &&
			!selectedSeries.some(ss => ss.id === s.id)
		).slice(0, 10)
	);
	let canCreateSeries = $derived(
		seriesSearch.trim().length > 0 &&
		!availableSeries.some((s: any) => s.title.toLowerCase() === seriesSearch.trim().toLowerCase())
	);

	// Narrator picker state
	let selectedNarrator = $state<{ id: number; name: string } | null>(book.narrator ?? null);
	let narratorSearch = $state('');
	let showNarratorDropdown = $state(false);
	let creatingNarrator = $state(false);
	let availableNarrators = $state<{ id: number; name: string }[]>(options.narrators);
	let filteredNarrators = $derived(
		availableNarrators.filter((n: any) =>
			n.name.toLowerCase().includes(narratorSearch.toLowerCase())
		).slice(0, 10)
	);
	let canCreateNarrator = $derived(
		narratorSearch.trim().length > 0 &&
		!availableNarrators.some((n: any) => n.name.toLowerCase() === narratorSearch.trim().toLowerCase())
	);

	const tabs = [
		{ id: 'basic', label: 'Basic', icon: Info },
		{ id: 'summary', label: 'Summary', icon: AlignLeft },
		{ id: 'identifiers', label: 'IDs', icon: Fingerprint },
		{ id: 'cover', label: 'Cover', icon: Image },
		{ id: 'dates', label: 'Status', icon: CalendarDays },
		{ id: 'media', label: 'Media', icon: Music }
	] as const;

	const languages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Japanese', 'Chinese', 'Korean', 'Arabic', 'Hindi', 'Dutch', 'Swedish', 'Polish', 'Other'];
	const authorRoles = ['Author', 'Co-Author', 'Editor', 'Translator', 'Illustrator', 'Contributor', 'Foreword By', 'Afterword By'];

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
		selectedSeries = [...selectedSeries, { id: s.id, title: s.title, bookNum: seriesBookNum, bookNumEnd: '', isOmnibus: false }];
		seriesSearch = '';
		seriesBookNum = '';
		showSeriesDropdown = false;
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
				availableSeries = [...availableSeries, { id: newSeries.id, title: newSeries.title }];
				addSeries({ id: newSeries.id, title: newSeries.title });
			}
		} catch (e) {
			console.error('Failed to create series:', e);
		} finally {
			creatingSeries = false;
		}
	}

	function removeSeries(id: number) {
		selectedSeries = selectedSeries.filter(s => s.id !== id);
	}

	function selectNarrator(n: { id: number; name: string }) {
		selectedNarrator = { id: n.id, name: n.name };
		narratorSearch = '';
		showNarratorDropdown = false;
	}

	function clearNarrator() {
		selectedNarrator = null;
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
				selectNarrator({ id: newNarrator.id, name: newNarrator.name });
				toasts.success(`Created narrator "${newNarrator.name}"`);
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to create narrator');
			}
		} catch (e) {
			console.error('Failed to create narrator:', e);
			toasts.error('Failed to create narrator');
		} finally {
			creatingNarrator = false;
		}
	}

	function toggleOmnibus(index: number) {
		selectedSeries[index].isOmnibus = !selectedSeries[index].isOmnibus;
		if (!selectedSeries[index].isOmnibus) {
			selectedSeries[index].bookNumEnd = '';
		}
	}

	function toggleTag(tagId: number) {
		if (selectedTagIds.includes(tagId)) {
			selectedTagIds = selectedTagIds.filter(id => id !== tagId);
		} else {
			selectedTagIds = [...selectedTagIds, tagId];
		}
	}

	function toggleMediaSource(sourceId: number) {
		if (selectedMediaSourceIds.includes(sourceId)) {
			selectedMediaSourceIds = selectedMediaSourceIds.filter(id => id !== sourceId);
		} else {
			selectedMediaSourceIds = [...selectedMediaSourceIds, sourceId];
		}
	}

	async function createCustomSource() {
		if (!newSourceName.trim()) {
			toasts.error('Source name is required');
			return;
		}
		creatingSource = true;
		try {
			const res = await fetch('/api/media-sources', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newSourceName.trim(),
					icon: newSourceIcon,
					color: newSourceColor
				})
			});
			if (res.ok) {
				const newSource = await res.json();
				// Add to available sources and auto-select it
				availableMediaSources = [...availableMediaSources, newSource];
				selectedMediaSourceIds = [...selectedMediaSourceIds, newSource.id];
				toasts.success(`Added "${newSource.name}"`);
				// Reset modal
				showAddSourceModal = false;
				newSourceName = '';
				newSourceIcon = 'shopping-bag';
				newSourceColor = '#6c757d';
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to create source');
			}
		} catch {
			toasts.error('Failed to create source');
		} finally {
			creatingSource = false;
		}
	}

	async function downloadCover() {
		if (!originalCoverUrl) return;
		downloadingCover = true;
		try {
			const res = await fetch('/api/covers/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: originalCoverUrl, bookId: book.id })
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

	// Re-read the picker lists (e.g. an entity created elsewhere after this form loaded)
	async function refreshOptionLists(): Promise<boolean> {
		try {
			const res = await fetch('/api/books/options');
			if (!res.ok) return false;
			const fresh = await res.json();
			availableAuthors = fresh.authors;
			availableSeries = fresh.series;
			availableGenres = fresh.genres;
			availableNarrators = fresh.narrators;
			return true;
		} catch {
			return false;
		}
	}

	// Create an entity during metadata apply; if the create fails, refresh the lists once and look it up again
	async function createOrRefind<E>(
		endpoint: string,
		body: Record<string, string>,
		find: () => E | undefined,
		onCreated: (created: { id: number; name: string; title: string }) => E
	): Promise<E | undefined> {
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (res.ok) return onCreated(await res.json());
		} catch (e) {
			console.error(`Failed to create via ${endpoint}:`, e);
		}
		if (await refreshOptionLists()) return find();
		return undefined;
	}

	async function applyMetadataResult(result: any, selectedFields: string[]) {
		let appliedCount = 0;
		const failedEntities: string[] = [];
		let coverDownloaded = false;

		for (const field of selectedFields) {
			switch (field) {
				case 'title':
					if (result.title) { title = result.title; appliedCount++; }
					break;
				case 'summary':
					if (result.description) { summary = result.description; appliedCount++; }
					break;
				case 'coverUrl':
					// Automatically download the cover image - try coverUrl first, then thumbnailUrl
					const urlsToTry = [result.coverUrl, result.thumbnailUrl].filter(Boolean);
					if (urlsToTry.length > 0) {
						downloadingCover = true;
						for (const imageUrl of urlsToTry) {
							if (coverDownloaded) break;
							originalCoverUrl = imageUrl;
							try {
								const res = await fetch('/api/covers/download', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ url: imageUrl, bookId: book.id })
								});
								if (res.ok) {
									const data = await res.json();
									coverImageUrl = data.coverPath;
									coverDownloaded = true;
								}
							} catch {
								// Try next URL
							}
						}
						downloadingCover = false;
						appliedCount++;
					}
					break;
				case 'isbn13':
					if (result.isbn13) { isbn13 = result.isbn13; appliedCount++; }
					break;
				case 'isbn10':
					if (result.isbn10) { isbn10 = result.isbn10; appliedCount++; }
					break;
				case 'publisher':
					if (result.publisher) { publisher = result.publisher; appliedCount++; }
					break;
				case 'publishYear':
					if (result.publishYear) { publishYear = result.publishYear.toString(); appliedCount++; }
					break;
				case 'pageCount':
					if (result.pageCount) { pageCount = result.pageCount.toString(); appliedCount++; }
					break;
				case 'language':
					if (result.language) { language = result.language; appliedCount++; }
					break;
				case 'rating':
					// Store as provider rating, not user rating
					if (result.rating) {
						providerRating = result.rating.toString();
						providerRatingSource = result.provider;
						if (result.ratingCount) {
							providerRatingCount = result.ratingCount.toString();
						}
						appliedCount++;
					}
					break;
				case 'authors':
					if (result.authors?.length) {
						// Look up or create each author
						for (const authorName of result.authors) {
							const name = authorName.trim();
							if (!name) continue;

							// Check if author already selected
							if (selectedAuthors.some(a => a.name.toLowerCase() === name.toLowerCase())) continue;

							// Check if author exists in available list
							let existing = availableAuthors.find(a => a.name.toLowerCase() === name.toLowerCase());

							if (!existing) {
								// Create new author
								existing = await createOrRefind(
									'/api/authors',
									{ name },
									() => availableAuthors.find(a => a.name.toLowerCase() === name.toLowerCase()),
									(created) => {
										const entry = { id: created.id, name: created.name };
										availableAuthors = [...availableAuthors, entry];
										return entry;
									}
								);
							}

							if (existing) {
								selectedAuthors = [...selectedAuthors, { id: existing.id, name: existing.name, role: 'Author' }];
							} else {
								failedEntities.push(`Author '${name}'`);
							}
						}
						if (!failedEntities.some(f => f.startsWith('Author '))) appliedCount++;
					}
					break;
				case 'seriesName':
					if (result.seriesName) {
						const seriesTitle = result.seriesName.trim();

						// Check if series already selected
						if (!selectedSeries.some(s => s.title.toLowerCase() === seriesTitle.toLowerCase())) {
							// Check if series exists in available list
							let existing = availableSeries.find((s: any) => s.title.toLowerCase() === seriesTitle.toLowerCase());

							if (!existing) {
								// Create new series
								existing = await createOrRefind(
									'/api/series',
									{ title: seriesTitle },
									() => availableSeries.find((s: any) => s.title.toLowerCase() === seriesTitle.toLowerCase()),
									(created) => {
										const entry = { id: created.id, title: created.title };
										availableSeries = [...availableSeries, entry];
										return entry;
									}
								);
							}

							if (existing) {
								const bookNum = result.seriesNumber?.toString() || '';
								selectedSeries = [...selectedSeries, { id: existing.id, title: existing.title, bookNum, bookNumEnd: '', isOmnibus: false }];
							} else {
								failedEntities.push(`Series '${seriesTitle}'`);
							}
						}
						if (!failedEntities.some(f => f.startsWith('Series '))) appliedCount++;
					}
					break;
				case 'genres':
					if (result.genres?.length) {
						// Use the first genre from metadata
						const genreName = result.genres[0]?.trim();
						if (genreName) {
							// Check if genre exists
							let existing = availableGenres.find(g => g.name.toLowerCase() === genreName.toLowerCase());

							if (!existing) {
								// Create new genre
								existing = await createOrRefind(
									'/api/genres',
									{ name: genreName },
									() => availableGenres.find(g => g.name.toLowerCase() === genreName.toLowerCase()),
									(created) => {
										const entry = { id: created.id, name: created.name };
										availableGenres = [...availableGenres, entry];
										return entry;
									}
								);
							}

							if (existing) {
								genreId = existing.id.toString();
							} else {
								failedEntities.push(`Genre '${genreName}'`);
							}
						}
						if (!failedEntities.some(f => f.startsWith('Genre '))) appliedCount++;
					}
					break;
			}
		}

		// Store provider IDs
		if (result.provider === 'goodreads' && result.providerId) {
			goodreadsId = result.providerId;
		} else if (result.provider === 'googlebooks' && result.providerId) {
			googleBooksId = result.providerId;
		}

		const coverMsg = coverDownloaded ? ' (cover downloaded)' : '';
		const failedMsg = failedEntities.length > 0 ? ` - could not add: ${failedEntities.join(', ')}` : '';
		const message = `Applied ${appliedCount} of ${selectedFields.length} fields from ${result.provider}${coverMsg}${failedMsg}`;
		if (appliedCount < selectedFields.length) {
			toasts.warning(message);
		} else {
			toasts.success(message);
		}
	}

	async function handleEbookUpload(file: File) {
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
				// Server assigns the eBook format when the book had none; mirror it so Save doesn't clear it
				if (!formatId) {
					const ebookFormatId = data.formatId
						?? options.formats.find((f: { id: number; name: string }) => f.name.toLowerCase().includes('ebook'))?.id;
					if (ebookFormatId) formatId = ebookFormatId.toString();
				}
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
		if (file) handleEbookUpload(file);
	}

	function handleEbookSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleEbookUpload(file);
	}

	async function removeEbook() {
		if (!confirm('Remove the ebook file?')) return;
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

	// Audiobookshelf manual linking (admins, integration enabled); applies immediately, not on Save
	const canLinkAbs = !!data.absBaseUrl && data.isAdmin;
	let absItemId = $state<string | null>(book.absItemId ?? null);

	async function handleSave() {
		if (!title.trim()) return;
		// Number inputs bind numbers/null at runtime despite the string type
		const numberless = selectedSeries.filter(s => !String(s.bookNum ?? '').trim());
		if (numberless.length > 0) {
			const names = numberless.map(s => `'${s.title}'`).join(', ');
			toasts.error(`Series ${names} ${numberless.length === 1 ? 'needs a book number' : 'need book numbers'} before saving`);
			return;
		}
		saving = true;
		try {
			const res = await fetch(`/api/books/${book.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					summary: summary.trim() || null,
					comments: comments.trim() || null,
					rating: rating ? parseFloat(rating) : null,
					providerRating: providerRating ? parseFloat(providerRating) : null,
					providerRatingSource: providerRatingSource.trim() || null,
					providerRatingCount: providerRatingCount ? parseInt(providerRatingCount) : null,
					coverImageUrl: coverImageUrl.trim() || null,
					originalCoverUrl: originalCoverUrl.trim() || null,
					statusId: statusId ? parseInt(statusId) : null,
					genreId: genreId ? parseInt(genreId) : null,
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
						bookNumEnd: s.isOmnibus && s.bookNumEnd ? parseFloat(s.bookNumEnd) : null
					})),
					tagIds: selectedTagIds
				})
			});
			if (res.ok) {
				// Also save media sources
				let mediaSourcesSaved = false;
				try {
					const mediaRes = await fetch(`/api/books/${book.id}/media-sources`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							sources: selectedMediaSourceIds.map(id => ({ mediaSourceId: id }))
						})
					});
					mediaSourcesSaved = mediaRes.ok;
				} catch (e) {
					console.error('Failed to save media sources:', e);
				}

				if (!mediaSourcesSaved) {
					toasts.error('Book saved, but media sources failed to save');
					return;
				}

				toasts.success('Book saved');
				await tick(); // Ensure toast is added before navigation
				goto(`/books/${book.id}`);
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save book');
			}
		} catch (err) {
			toasts.error(err instanceof Error ? err.message : 'Failed to save book');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Edit {book.title} - BookShelf</title>
</svelte:head>

<!-- Click outside handlers for dropdowns -->
{#if showAuthorDropdown || showSeriesDropdown || showNarratorDropdown}
	<button
		type="button"
		class="fixed inset-0 z-10"
		onclick={() => { showAuthorDropdown = false; showSeriesDropdown = false; showNarratorDropdown = false; }}
		aria-label="Close dropdown"
	></button>
{/if}

<div class="min-h-full" style="background-color: var(--bg-primary);">
	<!-- Header -->
	<div class="sticky top-0 z-20" style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
		<div class="max-w-6xl mx-auto px-4 sm:px-6">
			<div class="flex items-center justify-between h-16">
				<button
					type="button"
					class="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
					style="color: var(--text-secondary);"
					onclick={() => goto(`/books/${book.id}`)}
				>
					<ArrowLeft class="w-4 h-4" />
					<span class="hidden sm:inline">Back</span>
				</button>

				<h1 class="font-semibold truncate max-w-[200px] sm:max-w-md" style="color: var(--text-primary);">
					Edit Book
				</h1>

				<div class="flex items-center gap-2">
					<button
						type="button"
						class="px-3 py-1.5 text-sm rounded-lg transition-colors"
						style="color: var(--text-muted);"
						onclick={() => goto(`/books/${book.id}`)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn-accent px-4 py-1.5 text-sm flex items-center gap-2"
						disabled={saving || !title.trim()}
						onclick={handleSave}
					>
						{#if saving}
							<Loader2 class="w-4 h-4 animate-spin" />
						{/if}
						Save
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-5xl mx-auto px-4 sm:px-6 py-4">
		<div class="flex gap-5">
			<!-- Sidebar with Cover Preview -->
			<div class="hidden lg:block w-44 flex-shrink-0">
				<div class="sticky top-20 space-y-3">
					<!-- Cover Preview with blurred background -->
					<div class="rounded-lg overflow-hidden shadow-md relative aspect-[2/3]" style="background-color: var(--bg-tertiary);">
						<!-- Blurred background -->
						{#if coverPreviewUrl}
							<img
								src={coverPreviewUrl}
								alt=""
								class="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60"
								aria-hidden="true"
							/>
						{/if}
						<img
							src={coverPreviewUrl || '/placeholder.png'}
							alt="Cover Preview"
							class="relative w-full h-full object-contain drop-shadow-lg"
							onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
						/>
					</div>

					<!-- Rating Quick Edit -->
					<div class="p-3 rounded-lg" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
						<label class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">Rating</label>
						<div class="flex items-center justify-between">
							{#each [1, 2, 3, 4, 5] as star}
								<button
									type="button"
									class="p-0.5 transition-transform hover:scale-110"
									onclick={() => rating = rating === star.toString() ? '' : star.toString()}
								>
									<Star
										class="w-5 h-5"
										style="color: {parseFloat(rating || '0') >= star ? '#fbbf24' : 'var(--text-muted)'}; fill: {parseFloat(rating || '0') >= star ? '#fbbf24' : 'none'};"
									/>
								</button>
							{/each}
						</div>
					</div>

					<!-- Quick Actions -->
					{#if ebookPath}
						<a
							href="/reader/{book.id}"
							class="w-full btn-accent flex items-center justify-center gap-2 py-2 text-sm rounded-lg"
						>
							<BookMarked class="w-4 h-4" />
							Read
						</a>
					{/if}
				</div>
			</div>

			<!-- Main Form -->
			<div class="flex-1 min-w-0">
				<form onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
					<!-- Tab Navigation -->
					<div class="mb-4 overflow-x-auto -mx-4 px-4">
						<div class="inline-flex gap-0.5 p-0.5 rounded-lg min-w-max" style="background-color: var(--bg-secondary);">
							{#each tabs as tab}
								<button
									type="button"
									class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all"
									style="background-color: {activeTab === tab.id ? 'var(--accent)' : 'transparent'}; color: {activeTab === tab.id ? 'white' : 'var(--text-muted)'};"
									onclick={() => activeTab = tab.id}
								>
									<svelte:component this={tab.icon} class="w-3.5 h-3.5" />
									{tab.label}
								</button>
							{/each}
						</div>
					</div>

					<!-- Tab Content -->
					<div class="space-y-3">
						<!-- Basic Info Tab -->
						{#if activeTab === 'basic'}
							<!-- Quick Metadata Search -->
							<div class="rounded-lg p-3" style="background: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, purple) 100%);">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<Database class="w-4 h-4 text-white" />
										<span class="text-sm font-medium text-white">Quick fill from online databases</span>
									</div>
									<button
										type="button"
										onclick={() => showMetadataModal = true}
										class="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5"
										style="background-color: white; color: var(--accent);"
									>
										<Search class="w-3.5 h-3.5" />
										Search Metadata
									</button>
								</div>
							</div>

							<!-- Title Section -->
							<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
								<label for="title" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
									Title <span style="color: var(--accent);">*</span>
								</label>
								<input
									id="title"
									type="text"
									bind:value={title}
									required
									class="w-full px-3 py-2 rounded-md transition-all focus:ring-2 focus:ring-offset-0"
									style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); --tw-ring-color: var(--accent);"
									placeholder="Book title"
								/>
							</div>

							<!-- Authors Section -->
							<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
								<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">
									Authors
								</h3>

								{#if selectedAuthors.length > 0}
									<div class="space-y-1.5 mb-3">
										{#each selectedAuthors as author, index}
											<div
												class="flex items-center gap-2 p-2 rounded transition-all"
												style="background-color: var(--bg-tertiary); border: 1px solid {index === 0 ? 'var(--accent)' : 'var(--border-color)'};"
											>
												<div class="flex-1 min-w-0">
													<p class="font-medium truncate text-sm" style="color: var(--text-primary);">{author.name}</p>
													{#if index === 0}
														<p class="text-xs" style="color: var(--accent);">Primary</p>
													{/if}
												</div>
												<select
													bind:value={selectedAuthors[index].role}
													class="text-xs py-1 px-1.5 rounded"
													style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary);"
												>
													{#each authorRoles as role}
														<option value={role}>{role}</option>
													{/each}
												</select>
												<button
													type="button"
													onclick={() => removeAuthor(author.id)}
													class="p-1 rounded transition-colors hover:bg-red-500/10"
													style="color: var(--text-muted);"
												>
													<X class="w-3.5 h-3.5" />
												</button>
											</div>
										{/each}
									</div>
								{/if}

								<div class="flex gap-2">
									<div class="relative flex-1">
										<input
											type="text"
											placeholder="Search authors..."
											bind:value={authorSearch}
											onfocus={() => showAuthorDropdown = true}
											class="w-full px-3 py-2 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										/>
										{#if showAuthorDropdown && filteredAuthors.length > 0}
											<div
												class="absolute z-20 w-full mt-1 rounded-lg shadow-xl max-h-40 overflow-y-auto"
												style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
											>
												{#each filteredAuthors as author}
													<button
														type="button"
														class="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2"
														style="color: var(--text-primary);"
														onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
														onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
														onclick={() => addAuthor(author)}
													>
														<Plus class="w-3.5 h-3.5" style="color: var(--accent);" />
														{author.name}
													</button>
												{/each}
											</div>
										{/if}
									</div>
									<select
										bind:value={authorRole}
										class="px-2 py-2 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
									>
										{#each authorRoles as role}
											<option value={role}>{role}</option>
										{/each}
									</select>
								</div>
							</div>

							<!-- Series Section -->
							<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
								<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Series</h3>

								{#if selectedSeries.length > 0}
									<div class="space-y-2 mb-3">
										{#each selectedSeries as s, index}
											<div
												class="p-3 rounded-lg"
												style="background-color: var(--bg-tertiary); border: 1px solid {index === 0 ? 'var(--accent)' : 'var(--border-color)'};"
											>
												<div class="flex items-center justify-between gap-2 mb-2">
													<div class="flex-1 min-w-0">
														<p class="font-medium truncate text-sm" style="color: var(--text-primary);">{s.title}</p>
														{#if index === 0}
															<p class="text-xs" style="color: var(--accent);">Primary</p>
														{/if}
													</div>
													<button
														type="button"
														onclick={() => removeSeries(s.id)}
														class="p-1 rounded transition-colors hover:bg-red-500/10"
														style="color: var(--text-muted);"
													>
														<X class="w-3.5 h-3.5" />
													</button>
												</div>

												<div class="flex items-center gap-2 flex-wrap">
													<div class="flex items-center gap-1.5">
														<span class="text-xs" style="color: var(--text-muted);">#</span>
														<input
															type="number"
															placeholder="1"
															step="0.5"
															bind:value={selectedSeries[index].bookNum}
															class="w-16 px-2 py-1 text-sm text-center rounded"
															style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary);"
														/>
													</div>

													<button
														type="button"
														class="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
														style="background-color: {s.isOmnibus ? 'var(--accent)' : 'var(--bg-secondary)'}; color: {s.isOmnibus ? 'white' : 'var(--text-muted)'}; border: 1px solid {s.isOmnibus ? 'transparent' : 'var(--border-color)'};"
														onclick={() => toggleOmnibus(index)}
													>
														{#if s.isOmnibus}
															<Minus class="w-3 h-3" />
														{:else}
															<Plus class="w-3 h-3" />
														{/if}
														Omnibus
													</button>

													{#if s.isOmnibus}
														<div class="flex items-center gap-1.5">
															<ChevronRight class="w-3.5 h-3.5" style="color: var(--text-muted);" />
															<input
																type="number"
																placeholder="3"
																step="1"
																bind:value={selectedSeries[index].bookNumEnd}
																class="w-16 px-2 py-1 text-sm text-center rounded"
																style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary);"
															/>
														</div>
													{/if}

													{#if s.bookNum && s.isOmnibus && s.bookNumEnd}
														<span class="text-xs" style="color: var(--accent);">Books {s.bookNum}-{s.bookNumEnd}</span>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{/if}

								<div class="flex gap-2">
									<div class="relative flex-1">
										<input
											type="text"
											placeholder="Search series..."
											bind:value={seriesSearch}
											onfocus={() => showSeriesDropdown = true}
											oninput={() => showSeriesDropdown = true}
											class="w-full px-3 py-2 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										/>
										{#if showSeriesDropdown}
											<div
												class="absolute z-20 w-full mt-1 rounded-lg shadow-xl max-h-40 overflow-y-auto"
												style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
											>
												{#each filteredSeries as s}
													<button
														type="button"
														class="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2"
														style="color: var(--text-primary);"
														onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
														onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
														onclick={() => addSeries(s)}
													>
														<Plus class="w-3.5 h-3.5" style="color: var(--accent);" />
														{s.title}
													</button>
												{/each}
												{#if canCreateSeries}
													<button
														type="button"
														class="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 font-medium"
														style="color: var(--success); border-top: 1px solid var(--border-color);"
														onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
														onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
														onclick={createNewSeries}
														disabled={creatingSeries}
													>
														{#if creatingSeries}
															<Loader2 class="w-3.5 h-3.5 animate-spin" />
															Creating...
														{:else}
															<Plus class="w-3.5 h-3.5" />
															Create "{seriesSearch.trim()}"
														{/if}
													</button>
												{:else if filteredSeries.length === 0 && seriesSearch.trim().length === 0}
													<div class="px-3 py-2 text-sm" style="color: var(--text-muted);">
														Type to search or create a new series
													</div>
												{:else if filteredSeries.length === 0}
													<div class="px-3 py-2 text-sm" style="color: var(--text-muted);">
														No matching series found
													</div>
												{/if}
											</div>
										{/if}
									</div>
									<input
										type="number"
										placeholder="#"
										step="0.5"
										bind:value={seriesBookNum}
										class="w-16 px-2 py-2 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
									/>
								</div>
							</div>

							<!-- Narrator Section -->
							<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
								<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Narrator</h3>

								{#if selectedNarrator}
									<div
										class="flex items-center justify-between gap-2 p-3 rounded-lg"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color);"
									>
										<p class="flex-1 min-w-0 font-medium truncate text-sm" style="color: var(--text-primary);">{selectedNarrator.name}</p>
										<button
											type="button"
											onclick={clearNarrator}
											class="p-1 rounded transition-colors hover:bg-red-500/10"
											style="color: var(--text-muted);"
										>
											<X class="w-3.5 h-3.5" />
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
											class="w-full px-3 py-2 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										/>
										{#if showNarratorDropdown}
											<div
												class="absolute z-20 w-full mt-1 rounded-lg shadow-xl max-h-40 overflow-y-auto"
												style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
											>
												{#each filteredNarrators as n}
													<button
														type="button"
														class="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2"
														style="color: var(--text-primary);"
														onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
														onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
														onclick={() => selectNarrator(n)}
													>
														<Plus class="w-3.5 h-3.5" style="color: var(--accent);" />
														{n.name}
													</button>
												{/each}
												{#if canCreateNarrator}
													<button
														type="button"
														class="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 font-medium"
														style="color: var(--success); border-top: 1px solid var(--border-color);"
														onmouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
														onmouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
														onclick={createNewNarrator}
														disabled={creatingNarrator}
													>
														{#if creatingNarrator}
															<Loader2 class="w-3.5 h-3.5 animate-spin" />
															Creating...
														{:else}
															<Plus class="w-3.5 h-3.5" />
															Create "{narratorSearch.trim()}"
														{/if}
													</button>
												{:else if filteredNarrators.length === 0 && narratorSearch.trim().length === 0}
													<div class="px-3 py-2 text-sm" style="color: var(--text-muted);">
														Type to search or create a new narrator
													</div>
												{:else if filteredNarrators.length === 0}
													<div class="px-3 py-2 text-sm" style="color: var(--text-muted);">
														No matching narrators found
													</div>
												{/if}
											</div>
										{/if}
									</div>
								{/if}
							</div>

							<!-- Classification -->
							<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
								<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Classification</h3>
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label for="genreId" class="block text-xs mb-1" style="color: var(--text-muted);">Genre</label>
										<select
											id="genreId"
											bind:value={genreId}
											class="w-full px-2 py-1.5 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										>
											<option value="">-</option>
											{#each availableGenres as genre}
												<option value={genre.id.toString()}>{genre.name}</option>
											{/each}
										</select>
									</div>
									<div>
										<label for="formatId" class="block text-xs mb-1" style="color: var(--text-muted);">Format</label>
										<select
											id="formatId"
											bind:value={formatId}
											class="w-full px-2 py-1.5 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										>
											<option value="">-</option>
											{#each options.formats as format}
												<option value={format.id.toString()}>{format.name}</option>
											{/each}
										</select>
									</div>
								</div>
							</div>

							<!-- Publication Details -->
							<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
								<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Publication</h3>
								<div class="grid grid-cols-4 gap-3">
									<div>
										<label for="publisher" class="block text-xs mb-1" style="color: var(--text-muted);">Publisher</label>
										<input
											id="publisher"
											type="text"
											bind:value={publisher}
											class="w-full px-2 py-1.5 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										/>
									</div>
									<div>
										<label for="publishYear" class="block text-xs mb-1" style="color: var(--text-muted);">Year</label>
										<input
											id="publishYear"
											type="number"
											min="1000"
											max="2100"
											bind:value={publishYear}
											class="w-full px-2 py-1.5 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										/>
									</div>
									<div>
										<label for="pageCount" class="block text-xs mb-1" style="color: var(--text-muted);">Pages</label>
										<input
											id="pageCount"
											type="number"
											bind:value={pageCount}
											class="w-full px-2 py-1.5 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										/>
									</div>
									<div>
										<label for="language" class="block text-xs mb-1" style="color: var(--text-muted);">Language</label>
										<select
											id="language"
											bind:value={language}
											class="w-full px-2 py-1.5 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										>
											{#each languages as lang}
												<option value={lang}>{lang}</option>
											{/each}
										</select>
									</div>
								</div>
							</div>
						{/if}

						<!-- Summary Tab -->
						{#if activeTab === 'summary'}
							<div class="space-y-3">
								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<label for="summary" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">Book Summary</label>
									<textarea
										id="summary"
										bind:value={summary}
										rows="10"
										class="w-full px-3 py-2 rounded-md text-sm resize-y"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										placeholder="Enter a brief summary or description..."
									></textarea>
								</div>
								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<label for="comments" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">Personal Notes</label>
									<textarea
										id="comments"
										bind:value={comments}
										rows="5"
										class="w-full px-3 py-2 rounded-md text-sm resize-y"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										placeholder="Your personal notes..."
									></textarea>
								</div>
							</div>
						{/if}

						<!-- Identifiers Tab -->
						{#if activeTab === 'identifiers'}
							<div class="space-y-3">
								<!-- Metadata Search -->
								<div class="rounded-lg p-4" style="background: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, purple) 100%);">
									<div class="flex items-center gap-2 mb-2">
										<Database class="w-4 h-4 text-white" />
										<h3 class="font-medium text-sm text-white">Metadata Lookup</h3>
									</div>
									<p class="text-xs text-white/80 mb-3">
										Search Google Books, Open Library, Goodreads, and Hardcover for book information
									</p>
									<button
										type="button"
										onclick={() => showMetadataModal = true}
										class="w-full py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
										style="background-color: white; color: var(--accent);"
									>
										<Search class="w-4 h-4" />
										Search Metadata Providers
									</button>
								</div>

								<!-- Identifier Fields -->
								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Book Identifiers</h3>
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label for="isbn13" class="block text-xs mb-1" style="color: var(--text-muted);">ISBN-13</label>
											<input
												id="isbn13"
												type="text"
												bind:value={isbn13}
												class="w-full px-2 py-1.5 rounded-md text-sm font-mono"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
												placeholder="978-0-00-000000-0"
											/>
										</div>
										<div>
											<label for="isbn10" class="block text-xs mb-1" style="color: var(--text-muted);">ISBN-10</label>
											<input
												id="isbn10"
												type="text"
												bind:value={isbn10}
												class="w-full px-2 py-1.5 rounded-md text-sm font-mono"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
												placeholder="0-00-000000-0"
											/>
										</div>
										<div>
											<label for="asin" class="block text-xs mb-1" style="color: var(--text-muted);">ASIN</label>
											<input
												id="asin"
												type="text"
												bind:value={asin}
												class="w-full px-2 py-1.5 rounded-md text-sm font-mono"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
												placeholder="B000000000"
											/>
										</div>
										<div>
											<label for="goodreadsId" class="block text-xs mb-1" style="color: var(--text-muted);">Goodreads ID</label>
											<input
												id="goodreadsId"
												type="text"
												bind:value={goodreadsId}
												class="w-full px-2 py-1.5 rounded-md text-sm font-mono"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
												placeholder="12345678"
											/>
										</div>
									</div>
								</div>
							</div>
						{/if}

						<!-- Cover Image Tab -->
						{#if activeTab === 'cover'}
							<div class="space-y-3">
								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
										<Image class="w-3.5 h-3.5" />
										Cover from URL
									</h3>
									<div class="flex gap-2">
										<input
											type="url"
											placeholder="https://example.com/cover.jpg"
											bind:value={originalCoverUrl}
											class="flex-1 px-3 py-2 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										/>
										<button
											type="button"
											onclick={downloadCover}
											disabled={downloadingCover || !originalCoverUrl}
											class="btn-accent flex items-center gap-2 px-3 py-2 text-sm"
										>
											{#if downloadingCover}
												<Loader2 class="w-3.5 h-3.5 animate-spin" />
											{:else}
												<Download class="w-3.5 h-3.5" />
											{/if}
											Save
										</button>
									</div>
								</div>

								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<h4 class="text-xs font-medium mb-2" style="color: var(--text-muted);">Cover Status</h4>
									<div class="grid grid-cols-2 gap-3">
										<div class="p-2 rounded" style="background-color: var(--bg-tertiary);">
											<p class="text-xs mb-0.5" style="color: var(--text-muted);">External URL</p>
											<p class="text-xs truncate" style="color: var(--text-primary);">{originalCoverUrl || 'Not set'}</p>
										</div>
										<div class="p-2 rounded" style="background-color: var(--bg-tertiary);">
											<p class="text-xs mb-0.5" style="color: var(--text-muted);">Local File</p>
											<p class="text-xs truncate" style="color: var(--text-primary);">{coverImageUrl || 'Not saved'}</p>
										</div>
									</div>
								</div>

								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<label for="coverImageUrl" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">Local Cover Path (Advanced)</label>
									<input
										id="coverImageUrl"
										type="text"
										bind:value={coverImageUrl}
										placeholder="/covers/book-cover.jpg"
										class="w-full px-3 py-2 rounded-md font-mono text-xs"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
									/>
								</div>
							</div>
						{/if}

						<!-- Dates & Status Tab -->
						{#if activeTab === 'dates'}
							<div class="space-y-3">
								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Reading Status</h3>
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label for="statusId" class="block text-xs mb-1" style="color: var(--text-muted);">Status</label>
											<select
												id="statusId"
												bind:value={statusId}
												class="w-full px-2 py-1.5 rounded-md text-sm"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
											>
												<option value="">-</option>
												{#each options.statuses as status}
													<option value={status.id.toString()}>{status.name}</option>
												{/each}
											</select>
										</div>
										<div>
											<label for="rating2" class="block text-xs mb-1" style="color: var(--text-muted);">Rating</label>
											<input
												id="rating2"
												type="number"
												min="0"
												max="5"
												step="0.5"
												bind:value={rating}
												placeholder="0-5"
												class="w-full px-2 py-1.5 rounded-md text-sm"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
											/>
										</div>
									</div>
								</div>

								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Dates</h3>
									<div class="grid grid-cols-3 gap-3">
										<div>
											<label for="startReadingDate" class="block text-xs mb-1" style="color: var(--text-muted);">Started</label>
											<input
												id="startReadingDate"
												type="date"
												bind:value={startReadingDate}
												class="w-full px-2 py-1.5 rounded-md text-sm"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
											/>
										</div>
										<div>
											<label for="completedDate" class="block text-xs mb-1" style="color: var(--text-muted);">Completed</label>
											<input
												id="completedDate"
												type="date"
												bind:value={completedDate}
												class="w-full px-2 py-1.5 rounded-md text-sm"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
											/>
										</div>
										<div>
											<label for="releaseDate" class="block text-xs mb-1" style="color: var(--text-muted);">Released</label>
											<input
												id="releaseDate"
												type="date"
												bind:value={releaseDate}
												class="w-full px-2 py-1.5 rounded-md text-sm"
												style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
											/>
										</div>
									</div>
								</div>

								<!-- Tags -->
								{#if options.tags.length > 0}
									<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
										<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Tags</h3>
										<div class="flex flex-wrap gap-1.5">
											{#each options.tags as tag}
												<button
													type="button"
													class="px-3 py-1 text-xs rounded-full transition-all font-medium"
													style="background-color: {selectedTagIds.includes(tag.id) ? tag.color || 'var(--accent)' : 'var(--bg-tertiary)'}; color: {selectedTagIds.includes(tag.id) ? 'white' : 'var(--text-secondary)'}; border: 1px solid {selectedTagIds.includes(tag.id) ? 'transparent' : 'var(--border-color)'};"
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

						<!-- Media Tab -->
						{#if activeTab === 'media'}
							<div class="space-y-4">
								<!-- Ebook Section -->
								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
										<Tablet class="w-3.5 h-3.5" />
										Ebook
									</h3>
									{#if ebookPath}
										<div class="p-4 rounded-lg" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%); border: 1px solid rgba(16, 185, 129, 0.3);">
											<div class="flex items-center justify-between flex-wrap gap-3">
												<div class="flex items-center gap-3">
													<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background-color: rgba(16, 185, 129, 0.2);">
														<BookMarked class="w-5 h-5" style="color: #10b981;" />
													</div>
													<div>
														<p class="font-medium text-sm" style="color: var(--text-primary);">Ebook Attached</p>
														<p class="text-xs break-all" style="color: var(--text-muted);">{ebookPath}</p>
													</div>
												</div>
												<div class="flex gap-2">
													<a href="/reader/{book.id}" class="btn-accent px-3 py-1.5 text-sm">Read</a>
													<button
														type="button"
														class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
														style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);"
														onclick={removeEbook}
													>
														Remove
													</button>
												</div>
											</div>
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
											class="w-full border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer"
											style="border-color: {ebookDragOver ? 'var(--accent)' : 'var(--border-color)'}; background-color: {ebookDragOver ? 'var(--bg-hover)' : 'var(--bg-tertiary)'};"
											ondragover={(e) => { e.preventDefault(); ebookDragOver = true; }}
											ondragleave={() => ebookDragOver = false}
											ondrop={handleEbookDrop}
											onclick={() => ebookInputRef?.click()}
											disabled={uploadingEbook}
										>
											{#if uploadingEbook}
												<Loader2 class="w-8 h-8 mx-auto mb-2 animate-spin" style="color: var(--accent);" />
												<p class="text-sm font-medium" style="color: var(--accent);">Uploading...</p>
											{:else}
												<Tablet class="w-8 h-8 mx-auto mb-2" style="color: var(--text-muted);" />
												<p class="font-medium text-sm mb-1" style="color: var(--text-primary);">No ebook attached</p>
												<p class="text-xs" style="color: var(--text-muted);">EPUB, PDF, CBZ (max 100MB)</p>
											{/if}
										</button>
									{/if}
								</div>

								<!-- Audiobookshelf Section -->
								{#if canLinkAbs}
									<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
										<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
											<Headphones class="w-3.5 h-3.5" />
											Audiobookshelf
										</h3>
											<AbsLinkSection
												bookId={book.id}
												{absItemId}
												absBaseUrl={data.absBaseUrl ?? ''}
												initialQuery={title}
												onChange={(id) => absItemId = id}
											/>
									</div>
								{/if}

								<!-- Media Sources Section (where purchased) -->
								<div class="rounded-lg p-4" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
									<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
										<Library class="w-3.5 h-3.5" />
										Owned On
									</h3>
									<p class="text-xs mb-3" style="color: var(--text-muted);">
										Track where you purchased or own this book
									</p>

									<!-- Selected media sources -->
									{#if selectedMediaSourceIds.length > 0}
										<div class="flex flex-wrap gap-2 mb-3">
											{#each selectedMediaSourceIds as sourceId}
												{@const source = availableMediaSources.find((s: any) => s.id === sourceId)}
												{#if source}
													<button
														type="button"
														class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-white transition-opacity hover:opacity-80"
														style="background-color: {source.color || '#6c757d'}"
														onclick={() => toggleMediaSource(sourceId)}
														title="Click to remove"
													>
														<LucideIcon name={source.icon || 'shopping-bag'} size={12} />
														{source.name}
														<X class="w-3 h-3 ml-0.5" />
													</button>
												{/if}
											{/each}
										</div>
									{/if}

									<!-- Available media sources -->
									<div class="flex flex-wrap gap-2">
										{#each availableMediaSources as source}
											{#if !selectedMediaSourceIds.includes(source.id)}
												<button
													type="button"
													class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
													style="background-color: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color);"
													onclick={() => toggleMediaSource(source.id)}
												>
													<LucideIcon name={source.icon || 'shopping-bag'} size={12} />
													{source.name}
													<Plus class="w-3 h-3 ml-0.5" />
												</button>
											{/if}
										{/each}
										<!-- Add Custom Source button -->
										<button
											type="button"
											class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
											style="background-color: var(--accent); color: white;"
											onclick={() => showAddSourceModal = true}
										>
											<Plus class="w-3 h-3" />
											Add Custom
										</button>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</form>
			</div>
		</div>
	</div>
</div>

<!-- Metadata Search Modal -->
<MetadataSearchModal
	open={showMetadataModal}
	initialTitle={title}
	initialAuthor={selectedAuthors[0]?.name || ''}
	initialIsbn={isbn13 || isbn10 || ''}
	onClose={() => showMetadataModal = false}
	onApply={applyMetadataResult}
/>

<!-- Add Custom Media Source Modal -->
{#if showAddSourceModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(0, 0, 0, 0.6);"
		onclick={(e) => { if (e.target === e.currentTarget) showAddSourceModal = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') showAddSourceModal = false; }}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="w-full max-w-sm rounded-xl shadow-xl"
			style="background: var(--bg-secondary);"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b" style="border-color: var(--border-color);">
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Add Custom Source</h2>
				<button
					type="button"
					onclick={() => showAddSourceModal = false}
					class="p-1 rounded-lg transition-colors hover:bg-opacity-80"
					style="background: var(--bg-tertiary); color: var(--text-muted);"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Form -->
			<div class="p-4 space-y-4">
				<!-- Name -->
				<div>
					<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
						Name <span style="color: #ef4444;">*</span>
					</label>
					<input
						type="text"
						bind:value={newSourceName}
						placeholder="e.g., Storytel, Scribd..."
						class="w-full px-3 py-2 rounded-lg text-sm"
						style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
					/>
				</div>

				<!-- Icon -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Icon</label>
					<div class="flex flex-wrap gap-2">
						{#each sourceIcons as iconName}
							<button
								type="button"
								onclick={() => newSourceIcon = iconName}
								class="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
								style="background: {newSourceIcon === iconName ? newSourceColor : 'var(--bg-tertiary)'}; color: {newSourceIcon === iconName ? 'white' : 'var(--text-secondary)'}; border: 2px solid {newSourceIcon === iconName ? newSourceColor : 'transparent'};"
							>
								<LucideIcon name={iconName} size={16} />
							</button>
						{/each}
					</div>
				</div>

				<!-- Color -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Color</label>
					<div class="flex flex-wrap gap-2">
						{#each sourceColors as colorOption}
							<button
								type="button"
								onclick={() => newSourceColor = colorOption}
								class="w-7 h-7 rounded-full transition-all"
								style="background-color: {colorOption}; border: 3px solid {newSourceColor === colorOption ? 'white' : 'transparent'}; box-shadow: {newSourceColor === colorOption ? '0 0 0 2px ' + colorOption : 'none'};"
							></button>
						{/each}
					</div>
				</div>

				<!-- Preview -->
				<div class="pt-2">
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Preview</label>
					<div class="flex items-center gap-3 p-3 rounded-lg" style="background: var(--bg-tertiary);">
						<span
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white"
							style="background-color: {newSourceColor};"
						>
							<LucideIcon name={newSourceIcon} size={14} />
							{newSourceName || 'Source Name'}
						</span>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-2 p-4 border-t" style="border-color: var(--border-color);">
				<button
					type="button"
					onclick={() => showAddSourceModal = false}
					class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
					style="background: var(--bg-tertiary); color: var(--text-secondary);"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={createCustomSource}
					disabled={creatingSource || !newSourceName.trim()}
					class="btn-accent px-4 py-2 flex items-center gap-2"
				>
					{#if creatingSource}
						<Loader2 class="w-4 h-4 animate-spin" />
					{:else}
						<Plus class="w-4 h-4" />
					{/if}
					Create
				</button>
			</div>
		</div>
	</div>
{/if}
