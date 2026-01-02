import type { PageServerLoad } from './$types';
import { advancedSearch, getSearchOptions, type AdvancedSearchFilters } from '$lib/server/services/searchService';

export const load: PageServerLoad = async ({ url }) => {
	// Parse search filters from URL
	const filters: AdvancedSearchFilters = {};

	// Text filters
	const title = url.searchParams.get('title');
	if (title) filters.title = title;

	const authorName = url.searchParams.get('author');
	if (authorName) filters.authorName = authorName;

	const seriesTitle = url.searchParams.get('seriesTitle');
	if (seriesTitle) filters.seriesTitle = seriesTitle;

	const summaryComments = url.searchParams.get('summary');
	if (summaryComments) filters.summaryComments = summaryComments;

	// ID filters
	const statusId = url.searchParams.get('status');
	if (statusId) filters.statusId = parseInt(statusId, 10);

	const genreId = url.searchParams.get('genre');
	if (genreId) filters.genreId = parseInt(genreId, 10);

	const formatId = url.searchParams.get('format');
	if (formatId) filters.formatId = parseInt(formatId, 10);

	const seriesId = url.searchParams.get('series');
	if (seriesId) filters.seriesId = parseInt(seriesId, 10);

	const tagIds = url.searchParams.getAll('tag');
	if (tagIds.length > 0) {
		filters.tagIds = tagIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
	}

	// Range filters
	const ratingMin = url.searchParams.get('ratingMin');
	if (ratingMin) filters.ratingMin = parseFloat(ratingMin);

	const ratingMax = url.searchParams.get('ratingMax');
	if (ratingMax) filters.ratingMax = parseFloat(ratingMax);

	const pagesMin = url.searchParams.get('pagesMin');
	if (pagesMin) filters.pagesMin = parseInt(pagesMin, 10);

	const pagesMax = url.searchParams.get('pagesMax');
	if (pagesMax) filters.pagesMax = parseInt(pagesMax, 10);

	const completedFrom = url.searchParams.get('completedFrom');
	if (completedFrom) filters.completedFrom = completedFrom;

	const completedTo = url.searchParams.get('completedTo');
	if (completedTo) filters.completedTo = completedTo;

	const releaseFrom = url.searchParams.get('releaseFrom');
	if (releaseFrom) filters.releaseFrom = releaseFrom;

	const releaseTo = url.searchParams.get('releaseTo');
	if (releaseTo) filters.releaseTo = releaseTo;

	// Boolean filters
	if (url.searchParams.has('hasNarrator')) filters.hasNarrator = true;
	if (url.searchParams.has('hasRating')) filters.hasRating = true;
	if (url.searchParams.has('noRating')) filters.noRating = true;
	if (url.searchParams.has('hasCover')) filters.hasCover = true;
	if (url.searchParams.has('noCover')) filters.noCover = true;

	// Sorting
	const sortBy = url.searchParams.get('sortBy') as AdvancedSearchFilters['sortBy'];
	if (sortBy) filters.sortBy = sortBy;

	// Pagination
	const page = url.searchParams.get('page');
	if (page) filters.page = parseInt(page, 10);

	// Check if any search criteria provided
	const hasSearchCriteria = Object.keys(filters).some(key => !['page', 'limit', 'sortBy'].includes(key));

	// Get filter options
	const options = await getSearchOptions();

	// Perform search if criteria provided
	let results = null;
	if (hasSearchCriteria) {
		results = await advancedSearch(filters);
	}

	return {
		filters,
		options,
		results,
		searched: hasSearchCriteria
	};
};
