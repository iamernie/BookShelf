// Shared metadata-apply logic for the book forms (edit page, book detail page, add modal, add page).
// Client-side only: it calls the internal APIs with fetch and never touches page state directly.
// Callers pass in what the book already has plus the picker lists, and get back the values to apply,
// the relations to append, the refreshed lists and the toast to show.

export interface MetadataResult {
	provider: string;
	providerId?: string;
	title?: string;
	subtitle?: string;
	authors?: string[];
	description?: string;
	publisher?: string;
	publishedDate?: string;
	publishYear?: number;
	pageCount?: number;
	language?: string;
	isbn10?: string;
	isbn13?: string;
	coverUrl?: string;
	thumbnailUrl?: string;
	genres?: string[];
	seriesName?: string;
	seriesNumber?: number;
	rating?: number;
	ratingCount?: number;
}

export interface NamedOption { id: number; name: string }
export interface SeriesOption { id: number; title: string }

export interface OptionLists {
	authors: NamedOption[];
	series: SeriesOption[];
	genres: NamedOption[];
	narrators?: NamedOption[];
}

/** Mutable holder so refreshes and creates during an apply are visible to later lookups */
export interface OptionListsRef { current: OptionLists }

interface CreatedEntity { id: number; name: string; title: string }

// Re-read the picker lists from GET /api/books/options (unfiltered, so bookless entities are included)
export async function refreshOptionLists(lists: OptionListsRef): Promise<boolean> {
	try {
		const res = await fetch('/api/books/options');
		if (!res.ok) return false;
		const fresh = await res.json();
		lists.current = {
			authors: fresh.authors,
			series: fresh.series,
			genres: fresh.genres,
			narrators: fresh.narrators ?? lists.current.narrators
		};
		return true;
	} catch {
		return false;
	}
}

// Author names compare equal across case and punctuation spacing ("J. N. Chaney" == "J.N. Chaney")
export function normAuthorName(name: string): string {
	return name.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Create an entity during metadata apply. The pick lists can miss existing entities (e.g. bookless ones),
// so refresh and re-look-up before creating; if the create fails, refresh the lists once more and look it up again
export async function createOrRefind<E>(
	lists: OptionListsRef,
	endpoint: string,
	body: Record<string, string>,
	find: () => E | undefined,
	onCreated: (created: CreatedEntity) => E,
	preFind: () => E | undefined = find
): Promise<E | undefined> {
	if (await refreshOptionLists(lists)) {
		const found = preFind();
		if (found) return found;
	}
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
	if (await refreshOptionLists(lists)) return find();
	return undefined;
}

export interface MetadataApplyContext {
	/** Authors the book/form already has; additions are appended, nothing is removed */
	authors: { id: number; name: string }[];
	/** Series the book/form already has; additions are appended, nothing is removed */
	series: { id: number; title: string }[];
	/** Current picker lists; the refreshed lists come back on the outcome */
	lists: OptionLists;
	/**
	 * 'download': fetch the cover now (coverUrl, then thumbnailUrl) for an existing book.
	 * 'url': only record the cover URL (create forms download it after the book exists).
	 */
	cover: { mode: 'download'; bookId: number } | { mode: 'url' };
	onCoverDownloading?: (active: boolean) => void;
}

/** Field values to apply. The personal rating is never part of this; provider ratings go to providerRating* */
export interface AppliedMetadataFields {
	title?: string;
	summary?: string;
	originalCoverUrl?: string;
	coverImageUrl?: string;
	isbn13?: string;
	isbn10?: string;
	publisher?: string;
	publishYear?: number;
	pageCount?: number;
	language?: string;
	providerRating?: number;
	providerRatingSource?: string;
	providerRatingCount?: number;
	genre?: NamedOption;
	goodreadsId?: string;
	googleBooksId?: string;
}

export interface MetadataApplyOutcome {
	fields: AppliedMetadataFields;
	/** Authors to append to the book's existing authors */
	addedAuthors: { id: number; name: string; role: string }[];
	/** Series to append to the book's existing series; bookNum is '' when the provider gave no number */
	addedSeries: { id: number; title: string; bookNum: string }[];
	lists: OptionLists;
	appliedCount: number;
	selectedCount: number;
	failedEntities: string[];
	coverDownloaded: boolean;
	provider: string;
}

export async function applyMetadataResult(
	result: MetadataResult,
	selectedFields: string[],
	ctx: MetadataApplyContext
): Promise<MetadataApplyOutcome> {
	const lists: OptionListsRef = { current: { ...ctx.lists } };
	const fields: AppliedMetadataFields = {};
	const authors = [...ctx.authors];
	const series = [...ctx.series];
	const addedAuthors: MetadataApplyOutcome['addedAuthors'] = [];
	const addedSeries: MetadataApplyOutcome['addedSeries'] = [];
	let appliedCount = 0;
	const failedEntities: string[] = [];
	let coverDownloaded = false;

	for (const field of selectedFields) {
		switch (field) {
			case 'title':
				if (result.title) { fields.title = result.title; appliedCount++; }
				break;
			case 'summary':
				if (result.description) { fields.summary = result.description; appliedCount++; }
				break;
			case 'coverUrl':
				if (ctx.cover.mode === 'url') {
					if (result.coverUrl) { fields.originalCoverUrl = result.coverUrl; appliedCount++; }
					break;
				}
				{
					// Download the cover image now - try coverUrl first, then thumbnailUrl
					const urlsToTry = [result.coverUrl, result.thumbnailUrl].filter((u): u is string => !!u);
					if (urlsToTry.length > 0) {
						ctx.onCoverDownloading?.(true);
						for (const imageUrl of urlsToTry) {
							if (coverDownloaded) break;
							fields.originalCoverUrl = imageUrl;
							try {
								const res = await fetch('/api/covers/download', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ url: imageUrl, bookId: ctx.cover.bookId })
								});
								if (res.ok) {
									const data = await res.json();
									fields.coverImageUrl = data.coverPath;
									coverDownloaded = true;
								}
							} catch {
								// Try next URL
							}
						}
						ctx.onCoverDownloading?.(false);
						appliedCount++;
					}
				}
				break;
			case 'isbn13':
				if (result.isbn13) { fields.isbn13 = result.isbn13; appliedCount++; }
				break;
			case 'isbn10':
				if (result.isbn10) { fields.isbn10 = result.isbn10; appliedCount++; }
				break;
			case 'publisher':
				if (result.publisher) { fields.publisher = result.publisher; appliedCount++; }
				break;
			case 'publishYear':
				if (result.publishYear) { fields.publishYear = result.publishYear; appliedCount++; }
				break;
			case 'pageCount':
				if (result.pageCount) { fields.pageCount = result.pageCount; appliedCount++; }
				break;
			case 'language':
				if (result.language) { fields.language = result.language; appliedCount++; }
				break;
			case 'rating':
				// Store as provider rating, not user rating
				if (result.rating) {
					fields.providerRating = result.rating;
					fields.providerRatingSource = result.provider;
					if (result.ratingCount) {
						fields.providerRatingCount = result.ratingCount;
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

						// Check if the book already has this author
						if (authors.some(a => a.name.toLowerCase() === name.toLowerCase())) continue;

						// Check if author exists in available list
						let existing = lists.current.authors.find(a => a.name.toLowerCase() === name.toLowerCase());

						if (!existing) {
							// Create new author
							existing = await createOrRefind(
								lists,
								'/api/authors',
								{ name },
								() => lists.current.authors.find(a => a.name.toLowerCase() === name.toLowerCase()),
								(created) => {
									const entry = { id: created.id, name: created.name };
									lists.current.authors = [...lists.current.authors, entry];
									return entry;
								},
								() => lists.current.authors.find(a => normAuthorName(a.name) === normAuthorName(name))
							);
						}
						// The normalized relookup can resolve to an author the book already has
						if (existing && authors.some(a => a.id === existing!.id)) continue;

						if (existing) {
							const entry = { id: existing.id, name: existing.name, role: 'Author' };
							authors.push(entry);
							addedAuthors.push(entry);
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

					// Check if the book is already in this series
					if (!series.some(s => s.title.toLowerCase() === seriesTitle.toLowerCase())) {
						// Check if series exists in available list
						let existing = lists.current.series.find(s => s.title.toLowerCase() === seriesTitle.toLowerCase());

						if (!existing) {
							// Create new series
							existing = await createOrRefind(
								lists,
								'/api/series',
								{ title: seriesTitle },
								() => lists.current.series.find(s => s.title.toLowerCase() === seriesTitle.toLowerCase()),
								(created) => {
									const entry = { id: created.id, title: created.title };
									lists.current.series = [...lists.current.series, entry];
									return entry;
								}
							);
						}

						if (existing) {
							if (!series.some(s => s.id === existing!.id)) {
								// A series without a number is linked anyway (numberless saves are allowed)
								const entry = { id: existing.id, title: existing.title, bookNum: result.seriesNumber?.toString() || '' };
								series.push(entry);
								addedSeries.push(entry);
							}
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
						let existing = lists.current.genres.find(g => g.name.toLowerCase() === genreName.toLowerCase());

						if (!existing) {
							// Create new genre
							existing = await createOrRefind(
								lists,
								'/api/genres',
								{ name: genreName },
								() => lists.current.genres.find(g => g.name.toLowerCase() === genreName.toLowerCase()),
								(created) => {
									const entry = { id: created.id, name: created.name };
									lists.current.genres = [...lists.current.genres, entry];
									return entry;
								}
							);
						}

						if (existing) {
							fields.genre = { id: existing.id, name: existing.name };
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
		fields.goodreadsId = result.providerId;
	} else if (result.provider === 'googlebooks' && result.providerId) {
		fields.googleBooksId = result.providerId;
	}

	return {
		fields,
		addedAuthors,
		addedSeries,
		lists: lists.current,
		appliedCount,
		selectedCount: selectedFields.length,
		failedEntities,
		coverDownloaded,
		provider: result.provider
	};
}

/** Parse a form series number; '' (numberless) and junk become null */
export function parseSeriesNumber(bookNum: string): number | null {
	if (!bookNum) return null;
	const n = parseFloat(bookNum);
	return isNaN(n) ? null : n;
}

/**
 * Toast for an apply outcome. Pass appliedCount = 0 when nothing was persisted.
 * Warning when fewer fields applied than were selected; names the entities that could not be added.
 */
export function metadataApplyToast(
	outcome: MetadataApplyOutcome,
	appliedCount: number = outcome.appliedCount
): { level: 'success' | 'warning'; message: string } {
	const coverMsg = outcome.coverDownloaded ? ' (cover downloaded)' : '';
	const failedMsg = outcome.failedEntities.length > 0 ? ` - could not add: ${outcome.failedEntities.join(', ')}` : '';
	const message = `Applied ${appliedCount} of ${outcome.selectedCount} fields from ${outcome.provider}${coverMsg}${failedMsg}`;
	return { level: appliedCount < outcome.selectedCount ? 'warning' : 'success', message };
}
