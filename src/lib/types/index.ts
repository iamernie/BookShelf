// Shared types for the application

/**
 * Minimal book data for card display
 */
export interface BookCardData {
	id: number;
	title: string;
	coverImageUrl?: string | null;
	rating?: number | null;
	bookNum?: number | null;
	ebookPath?: string | null;
	audiobookId?: number | null;
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
