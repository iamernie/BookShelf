/**
 * Centralized date formatting utilities for BookShelf
 *
 * Calendar dates (release, started, completed, birth/death) are stored as date-only
 * strings: "2023-12-12". Legacy rows may hold "2023-12-12 00:00:00.000 +00:00".
 * Both are treated as calendar dates, never as UTC-midnight instants.
 * Timestamps (createdAt, expiresAt, ...) are full ISO strings and display in local time.
 * HTML date inputs require: "YYYY-MM-DD"
 * Display should be consistent: "December 12, 2023" or configurable
 */

export type DateDisplayFormat = 'long' | 'short' | 'iso';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
// A calendar date stored as a UTC-midnight timestamp, e.g. "2023-12-12 00:00:00.000 +00:00"
const UTC_MIDNIGHT_RE = /^(\d{4}-\d{2}-\d{2})[T ]00:00:00(?:\.0+)?\s*(?:Z|[+-]00:?00)$/;

/**
 * True for a date-only string (YYYY-MM-DD). Date-only values are calendar dates,
 * not timestamps: new Date() would read them as UTC midnight and local display
 * would shift them a day early west of UTC.
 */
export function isDateOnly(value: unknown): value is string {
	return typeof value === 'string' && DATE_ONLY_RE.test(value);
}

/**
 * The YYYY-MM-DD calendar date carried by a value, or null if it is a true timestamp
 */
function calendarDate(dateStr: string): string | null {
	const value = dateStr.trim();
	if (DATE_ONLY_RE.test(value)) return value;
	const match = value.match(UTC_MIDNIGHT_RE);
	return match ? match[1] : null;
}

/**
 * Parse a date value to a Date at local midnight for calendar dates, or the exact
 * instant for true timestamps. Use this instead of new Date() when reading
 * local fields (getMonth, getDate, toLocaleDateString) from a possibly date-only value.
 */
export function toLocalDate(dateStr: string): Date {
	const day = calendarDate(dateStr);
	if (!day) return new Date(dateStr);
	const [year, month, date] = day.split('-').map(Number);
	return new Date(year, month - 1, date);
}

/**
 * Format a date string for display to users
 * @param dateStr - Date-only string (YYYY-MM-DD) or full timestamp
 * @param format - Display format: 'long' (December 12, 2023), 'short' (12/12/2023), 'iso' (2023-12-12)
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(dateStr: string | null | undefined, format: DateDisplayFormat = 'long'): string {
	if (!dateStr) return '';

	try {
		if (format === 'iso') return toInputDate(dateStr);

		const options: Intl.DateTimeFormatOptions =
			format === 'short'
				? { year: 'numeric', month: '2-digit', day: '2-digit' }
				: { year: 'numeric', month: 'long', day: 'numeric' };

		// Calendar dates are formatted in UTC so the day never shifts
		const day = calendarDate(dateStr);
		if (day) {
			const [year, month, date] = day.split('-').map(Number);
			const utc = new Date(Date.UTC(year, month - 1, date));
			if (isNaN(utc.getTime())) return '';
			return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(utc);
		}

		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return '';
		return date.toLocaleDateString('en-US', options);
	} catch {
		return '';
	}
}

/**
 * Convert a database date string to HTML date input format (YYYY-MM-DD)
 * @param dateStr - Date-only string (returned as-is) or full timestamp (converted to its local date)
 * @returns Date in YYYY-MM-DD format for HTML input, or empty string if invalid
 */
export function toInputDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '';

	// Calendar dates pass through untouched so saving a form never shifts them
	const day = calendarDate(dateStr);
	if (day) return day;

	try {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return '';

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const dayOfMonth = String(date.getDate()).padStart(2, '0');

		return `${year}-${month}-${dayOfMonth}`;
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
		const date = toLocalDate(dateStr);
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
 * True when a book's releaseDate is after today (local date, string compare on YYYY-MM-DD)
 */
export function isPrerelease(releaseDate: string | null | undefined): boolean {
	if (!releaseDate) return false;
	return releaseDate.slice(0, 10) > getCurrentInputDate();
}

/**
 * Tooltip for the pre-release banner, e.g. "Releases Nov 17, 2026"
 */
export function formatReleaseTooltip(releaseDate: string | null | undefined): string {
	if (!releaseDate) return '';
	return `Releases ${formatReleaseDate(releaseDate)}`;
}

/**
 * Release date as shown in the pre-release tooltip, e.g. "Nov 17, 2026"
 */
export function formatReleaseDate(releaseDate: string | null | undefined): string {
	if (!releaseDate) return '';
	const match = releaseDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!match) return releaseDate;
	// Build a local date so the day never shifts across timezones
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Get current date/time as ISO string for database storage
 */
export function getCurrentISODate(): string {
	return new Date().toISOString();
}
