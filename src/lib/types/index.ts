// Shared types for the application

/**
 * Minimal book data for card display
 */
export interface BookCardData {
	id: number;
	title: string;
	coverImageUrl?: string | null;
	originalCoverUrl?: string | null;
	rating?: number | null;
	bookNum?: number | null;
	ebookPath?: string | null;
	absItemId?: string | null;
	releaseDate?: string | null;
	authorName?: string | null;
	seriesName?: string | null;
	summary?: string | null;
	status?: {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	} | null;
	genre?: {
		id: number;
		name: string;
	} | null;
	format?: {
		id: number;
		name: string;
		icon?: string | null;
		color?: string | null;
	} | null;
	tags?: {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	}[];
	completedDate?: string | null;
}

/**
 * Author with role information for book display
 */
export interface BookAuthorData {
	id: number;
	name: string;
	role?: string;
	isPrimary?: boolean;
}

/**
 * Series with book number for book display
 */
export interface BookSeriesData {
	id: number;
	title: string;
	bookNum?: number | null;
	bookNumEnd?: number | null;
	isPrimary?: boolean;
}

/** A book Audible lists in a series that the user doesn't own yet (2.27.0) */
export interface AudibleSuggestion {
	asin: string;
	title: string;
	subtitle: string | null;
	sequence: number | null;
	/** As Audible numbers it ("3.5", "1-10"); null when unnumbered */
	sequenceLabel: string | null;
	/** An omnibus range: listed, but never "next" and never a gap */
	isRange: boolean;
	authors: string[];
	narrators: string[];
	runtimeMin: number | null;
	coverUrl: string | null;
	releaseDate: string | null;
	audibleUrl: string;
}
