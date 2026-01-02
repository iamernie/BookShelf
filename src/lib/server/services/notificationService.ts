import { db, bookSeries, books, series, statuses } from '$lib/server/db';
import { userPreferences } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getSetting, getSettingAs } from './settingsService';

// Notification event types
export type NotificationEvent =
	| 'book_added'
	| 'book_completed'
	| 'goal_reached'
	| 'series_completed'
	| 'backup_completed'
	| 'test';

// ntfy priority levels
export type NtfyPriority = 1 | 2 | 3 | 4 | 5;

// Notification payload
export interface NotificationPayload {
	title: string;
	message: string;
	priority?: NtfyPriority;
	tags?: string[];
	click?: string;
}

// Map event types to user preference columns
const eventToPreferenceColumn: Record<NotificationEvent, keyof typeof userPreferences.$inferSelect | null> = {
	book_added: 'notifyBookAdded',
	book_completed: 'notifyBookCompleted',
	goal_reached: 'notifyGoalReached',
	series_completed: 'notifySeriesCompleted',
	backup_completed: null, // System event, no user preference
	test: null // Always allowed for testing
};

/**
 * Check if ntfy notifications are enabled system-wide
 */
export async function isNtfyEnabled(): Promise<boolean> {
	return await getSettingAs<boolean>('notifications.ntfy_enabled', 'boolean');
}

/**
 * Get ntfy configuration
 */
export async function getNtfyConfig(): Promise<{ url: string; adminTopic: string; enabled: boolean }> {
	const [enabled, url, adminTopic] = await Promise.all([
		getSettingAs<boolean>('notifications.ntfy_enabled', 'boolean'),
		getSetting('notifications.ntfy_url'),
		getSetting('notifications.ntfy_admin_topic')
	]);

	return { enabled, url, adminTopic };
}

/**
 * Get user's notification preferences
 */
export async function getUserNotificationPrefs(userId: number): Promise<{
	ntfyTopic: string | null;
	ntfyEnabled: boolean;
	notifyBookAdded: boolean;
	notifyBookCompleted: boolean;
	notifyGoalReached: boolean;
	notifySeriesCompleted: boolean;
} | null> {
	const prefs = await db
		.select({
			ntfyTopic: userPreferences.ntfyTopic,
			ntfyEnabled: userPreferences.ntfyEnabled,
			notifyBookAdded: userPreferences.notifyBookAdded,
			notifyBookCompleted: userPreferences.notifyBookCompleted,
			notifyGoalReached: userPreferences.notifyGoalReached,
			notifySeriesCompleted: userPreferences.notifySeriesCompleted
		})
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.get();

	if (!prefs) return null;

	return {
		ntfyTopic: prefs.ntfyTopic,
		ntfyEnabled: prefs.ntfyEnabled ?? false,
		notifyBookAdded: prefs.notifyBookAdded ?? true,
		notifyBookCompleted: prefs.notifyBookCompleted ?? true,
		notifyGoalReached: prefs.notifyGoalReached ?? true,
		notifySeriesCompleted: prefs.notifySeriesCompleted ?? true
	};
}

/**
 * Check if a notification should be sent for a specific event
 */
export async function shouldNotify(userId: number, event: NotificationEvent): Promise<boolean> {
	// Check system-wide setting first
	const systemEnabled = await isNtfyEnabled();
	if (!systemEnabled) return false;

	// Test notifications always go through if system is enabled
	if (event === 'test') return true;

	// System events don't need user preferences
	if (event === 'backup_completed') return true;

	// Get user preferences
	const prefs = await getUserNotificationPrefs(userId);
	if (!prefs) return false;

	// Check user's master toggle
	if (!prefs.ntfyEnabled) return false;

	// Check user has a topic configured
	if (!prefs.ntfyTopic) return false;

	// Check event-specific preference
	const prefColumn = eventToPreferenceColumn[event];
	if (prefColumn && prefColumn in prefs) {
		return prefs[prefColumn as keyof typeof prefs] as boolean;
	}

	return true;
}

/**
 * Send a notification via ntfy
 */
async function sendNtfy(
	url: string,
	topic: string,
	payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
	try {
		// Remove trailing slash from URL if present
		const baseUrl = url.replace(/\/$/, '');

		const response = await fetch(`${baseUrl}/${topic}`, {
			method: 'POST',
			headers: {
				'Title': payload.title,
				...(payload.priority && { 'Priority': payload.priority.toString() }),
				...(payload.tags && payload.tags.length > 0 && { 'Tags': payload.tags.join(',') }),
				...(payload.click && { 'Click': payload.click })
			},
			body: payload.message
		});

		if (!response.ok) {
			const errorText = await response.text();
			return { success: false, error: `ntfy error: ${response.status} ${errorText}` };
		}

		return { success: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('[notifications] Failed to send ntfy notification:', message);
		return { success: false, error: message };
	}
}

/**
 * Send a notification to a user
 */
export async function sendNotification(
	userId: number,
	event: NotificationEvent,
	payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
	// Check if we should send this notification
	const shouldSend = await shouldNotify(userId, event);
	if (!shouldSend) {
		return { success: false, error: 'Notification disabled or not configured' };
	}

	// Get config
	const config = await getNtfyConfig();
	const prefs = await getUserNotificationPrefs(userId);

	if (!prefs?.ntfyTopic) {
		return { success: false, error: 'User has no ntfy topic configured' };
	}

	return sendNtfy(config.url, prefs.ntfyTopic, payload);
}

/**
 * Send a system notification (to admin topic)
 */
export async function sendSystemNotification(
	payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
	const config = await getNtfyConfig();

	if (!config.enabled) {
		return { success: false, error: 'ntfy notifications are disabled' };
	}

	if (!config.adminTopic) {
		return { success: false, error: 'No admin topic configured' };
	}

	return sendNtfy(config.url, config.adminTopic, payload);
}

/**
 * Send a test notification to a user
 */
export async function sendTestNotification(
	userId: number
): Promise<{ success: boolean; error?: string }> {
	return sendNotification(userId, 'test', {
		title: '📚 BookShelf Test',
		message: 'If you see this, notifications are working!',
		priority: 3,
		tags: ['white_check_mark', 'book']
	});
}

/**
 * Send a test notification to admin topic
 */
export async function sendAdminTestNotification(): Promise<{ success: boolean; error?: string }> {
	return sendSystemNotification({
		title: '📚 BookShelf Admin Test',
		message: 'Admin notifications are configured correctly!',
		priority: 3,
		tags: ['white_check_mark', 'gear']
	});
}

// ==================== Event-specific notification helpers ====================

/**
 * Notify when a book is added to library
 */
export async function notifyBookAdded(
	userId: number,
	book: { id: number; title: string; author?: string },
	baseUrl?: string
): Promise<void> {
	const message = book.author
		? `"${book.title}" by ${book.author} has been added to your library.`
		: `"${book.title}" has been added to your library.`;

	await sendNotification(userId, 'book_added', {
		title: '📖 Book Added',
		message,
		priority: 2,
		tags: ['book', 'heavy_plus_sign'],
		click: baseUrl ? `${baseUrl}/books/${book.id}` : undefined
	});
}

/**
 * Notify when a book is marked as completed
 */
export async function notifyBookCompleted(
	userId: number,
	book: { id: number; title: string },
	baseUrl?: string
): Promise<void> {
	await sendNotification(userId, 'book_completed', {
		title: '✅ Book Completed',
		message: `Congratulations! You finished reading "${book.title}".`,
		priority: 3,
		tags: ['book', 'white_check_mark'],
		click: baseUrl ? `${baseUrl}/books/${book.id}` : undefined
	});
}

/**
 * Notify when a reading goal is reached
 */
export async function notifyGoalReached(
	userId: number,
	goal: { target: number; type: string; year: number },
	baseUrl?: string
): Promise<void> {
	await sendNotification(userId, 'goal_reached', {
		title: '🎉 Goal Reached!',
		message: `Amazing! You've reached your ${goal.year} reading goal of ${goal.target} ${goal.type}!`,
		priority: 4,
		tags: ['tada', 'trophy'],
		click: baseUrl ? `${baseUrl}/stats/goals` : undefined
	});
}

/**
 * Notify when a series is completed
 */
export async function notifySeriesCompleted(
	userId: number,
	series: { id: number; title: string; bookCount: number },
	baseUrl?: string
): Promise<void> {
	await sendNotification(userId, 'series_completed', {
		title: '📚 Series Completed!',
		message: `You've finished the "${series.title}" series (${series.bookCount} books)!`,
		priority: 4,
		tags: ['books', 'star'],
		click: baseUrl ? `${baseUrl}/series/${series.id}` : undefined
	});
}

/**
 * Notify admin when backup is completed
 */
export async function notifyBackupCompleted(
	backupPath: string
): Promise<void> {
	await sendSystemNotification({
		title: '💾 Backup Completed',
		message: `Database backup created: ${backupPath}`,
		priority: 2,
		tags: ['floppy_disk', 'white_check_mark']
	});
}

/**
 * Check if completing a book completes any series and send notifications
 * Call this after marking a book as READ
 */
export async function checkAndNotifySeriesCompletion(
	userId: number,
	bookId: number,
	baseUrl?: string
): Promise<void> {
	try {
		// Get the READ status ID
		const readStatus = await db
			.select({ id: statuses.id })
			.from(statuses)
			.where(eq(statuses.key, 'READ'))
			.limit(1);

		const readStatusId = readStatus[0]?.id;
		if (!readStatusId) return;

		// Get all series that contain this book
		const bookSeriesLinks = await db
			.select({
				seriesId: bookSeries.seriesId,
				seriesTitle: series.title
			})
			.from(bookSeries)
			.innerJoin(series, eq(bookSeries.seriesId, series.id))
			.where(eq(bookSeries.bookId, bookId));

		for (const link of bookSeriesLinks) {
			// Get all books in this series
			const seriesBooks = await db
				.select({
					bookId: bookSeries.bookId,
					statusId: books.statusId
				})
				.from(bookSeries)
				.innerJoin(books, eq(bookSeries.bookId, books.id))
				.where(eq(bookSeries.seriesId, link.seriesId));

			const totalBooks = seriesBooks.length;
			if (totalBooks === 0) continue;

			// Count how many are read (include the one we just marked)
			const readBooks = seriesBooks.filter(b =>
				b.statusId === readStatusId || b.bookId === bookId
			).length;

			// If all books are now read, the series is complete!
			if (readBooks === totalBooks) {
				await notifySeriesCompleted(userId, {
					id: link.seriesId,
					title: link.seriesTitle,
					bookCount: totalBooks
				}, baseUrl);
			}
		}
	} catch (err) {
		console.error('[notifications] Failed to check series completion:', err);
	}
}
