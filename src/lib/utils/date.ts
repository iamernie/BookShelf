/**
 * Centralized date formatting utilities for BookShelf V2
 *
 * Database stores dates as ISO strings with timezone: "2023-12-12 00:00:00.000 +00:00"
 * HTML date inputs require: "YYYY-MM-DD"
 * Display should be consistent: "December 12, 2023" or configurable
 */

export type DateDisplayFormat = 'long' | 'short' | 'iso';

/**
 * Format a date string for display to users
 * @param dateStr - Date string from database (ISO format with timezone)
 * @param format - Display format: 'long' (December 12, 2023), 'short' (12/12/2023), 'iso' (2023-12-12)
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(dateStr: string | null | undefined, format: DateDisplayFormat = 'long'): string {
	if (!dateStr) return '';

	try {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return '';

		switch (format) {
			case 'long':
				return date.toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				});
			case 'short':
				return date.toLocaleDateString('en-US', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				});
			case 'iso':
				return toInputDate(dateStr);
			default:
				return date.toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				});
		}
	} catch {
		return '';
	}
}

/**
 * Convert a database date string to HTML date input format (YYYY-MM-DD)
 * @param dateStr - Date string from database
 * @returns Date in YYYY-MM-DD format for HTML input, or empty string if invalid
 */
export function toInputDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '';

	try {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return '';

		// Use UTC to avoid timezone shifts
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

		return `${year}-${month}-${day}`;
	} catch {
		return '';
	}
}

/**
 * Convert an HTML date input value to database format (ISO string)
 * @param inputDate - Date from HTML input (YYYY-MM-DD)
 * @returns ISO date string for database storage, or null if empty/invalid
 */
export function fromInputDate(inputDate: string | null | undefined): string | null {
	if (!inputDate || inputDate.trim() === '') return null;

	try {
		// Parse as local date to avoid timezone issues
		const [year, month, day] = inputDate.split('-').map(Number);
		const date = new Date(year, month - 1, day);

		if (isNaN(date.getTime())) return null;

		// Return ISO string
		return date.toISOString();
	} catch {
		return null;
	}
}

/**
 * Format a date for display with relative time (e.g., "2 days ago")
 * @param dateStr - Date string from database
 * @returns Relative time string or formatted date if too old
 */
export function formatRelativeDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '';

	try {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return '';

		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

		// Fall back to long format for older dates
		return formatDate(dateStr, 'long');
	} catch {
		return '';
	}
}

/**
 * Get current date in HTML input format (YYYY-MM-DD)
 */
export function getCurrentInputDate(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Get current date/time as ISO string for database storage
 */
export function getCurrentISODate(): string {
	return new Date().toISOString();
}
