/**
 * User Preferences Service
 * Manages user-specific settings and preferences
 */

import { db, userPreferences } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { UserPreference, NewUserPreference } from '$lib/server/db/schema';

// ============================================
// Dashboard Configuration Types
// ============================================

export type DashboardSectionId =
	| 'reading-goal'
	| 'continue-reading'
	| 'smart-collection'
	| 'up-next-series'
	| 'recently-added'
	| 'recently-completed';

export interface DashboardSection {
	id: DashboardSectionId;
	enabled: boolean;
	order: number;
	// For smart-collection type only:
	shelfId?: number;           // ID of Magic Shelf to use
	customFilter?: FilterConfig; // OR inline filter (dashboard-only)
	// For continue-reading section:
	companionSection?: 'up-next-series' | 'smart-collection' | 'none'; // What to show beside it
}

export interface FilterConfig {
	logic: 'AND' | 'OR';
	rules: FilterRule[];
}

export interface FilterRule {
	field: string;
	operator: string;
	value: string | number | boolean | null;
}

export interface DashboardConfig {
	sections: DashboardSection[];
}

// Default dashboard configuration
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
	sections: [
		{ id: 'reading-goal', enabled: true, order: 0 },
		{ id: 'continue-reading', enabled: true, order: 1, companionSection: 'up-next-series' },
		{ id: 'smart-collection', enabled: false, order: 2 }, // Disabled by default
		{ id: 'up-next-series', enabled: true, order: 3 },
		{ id: 'recently-added', enabled: true, order: 4 },
		{ id: 'recently-completed', enabled: true, order: 5 }
	]
};

// Human-readable section names for UI
export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
	'reading-goal': 'Reading Goal',
	'continue-reading': 'Currently Reading',
	'smart-collection': 'Smart Collection',
	'up-next-series': 'Up Next in Series',
	'recently-added': 'Recently Added',
	'recently-completed': 'Recently Completed'
};

// ============================================
// User Preferences Types
// ============================================

export interface UserPreferencesData {
	// Display
	theme: 'light' | 'dark' | 'system';
	accentColor: string;
	// Dashboard
	dashboardWidgets: DashboardWidgetConfig[] | null; // Legacy
	dashboardConfig: DashboardConfig | null;
	// Books view
	defaultBooksView: 'grid' | 'list' | 'table';
	defaultBooksSort: string;
	defaultBooksSortOrder: 'asc' | 'desc';
	booksPerPage: number;
	// Reader
	readerFontFamily: string;
	readerFontSize: number;
	readerLineHeight: number;
	readerTheme: 'auto' | 'light' | 'dark' | 'sepia';
	// Notifications
	emailNotifications: boolean;
	goalReminders: boolean;
	// ntfy Notifications
	ntfyTopic: string | null;
	ntfyEnabled: boolean;
	notifyBookAdded: boolean;
	notifyBookCompleted: boolean;
	notifyGoalReached: boolean;
	notifySeriesCompleted: boolean;
	// UI state
	sidebarCollapsed: boolean;
}

export interface DashboardWidgetConfig {
	id: string;
	enabled: boolean;
	order: number;
}

const DEFAULT_PREFERENCES: UserPreferencesData = {
	theme: 'system',
	accentColor: '#3b82f6',
	dashboardWidgets: null,
	dashboardConfig: null, // Will use DEFAULT_DASHBOARD_CONFIG when null
	defaultBooksView: 'grid',
	defaultBooksSort: 'title',
	defaultBooksSortOrder: 'asc',
	booksPerPage: 24,
	readerFontFamily: 'system',
	readerFontSize: 16,
	readerLineHeight: 1.6,
	readerTheme: 'auto',
	emailNotifications: false,
	goalReminders: true,
	ntfyTopic: null,
	ntfyEnabled: false,
	notifyBookAdded: true,
	notifyBookCompleted: true,
	notifyGoalReached: true,
	notifySeriesCompleted: true,
	sidebarCollapsed: false
};

/**
 * Get user preferences (creates defaults if not exists)
 */
export async function getUserPreferences(userId: number): Promise<UserPreferencesData> {
	const result = await db
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);

	if (result.length === 0) {
		// Create default preferences
		await createDefaultPreferences(userId);
		return { ...DEFAULT_PREFERENCES };
	}

	const prefs = result[0];

	// Parse dashboardConfig if present
	let dashboardConfig: DashboardConfig | null = null;
	if (prefs.dashboardConfig) {
		try {
			dashboardConfig = JSON.parse(prefs.dashboardConfig);
		} catch {
			dashboardConfig = null;
		}
	}

	return {
		theme: (prefs.theme as 'light' | 'dark' | 'system') || 'system',
		accentColor: prefs.accentColor || '#3b82f6',
		dashboardWidgets: prefs.dashboardWidgets ? JSON.parse(prefs.dashboardWidgets) : null,
		dashboardConfig,
		defaultBooksView: (prefs.defaultBooksView as 'grid' | 'list' | 'table') || 'grid',
		defaultBooksSort: prefs.defaultBooksSort || 'title',
		defaultBooksSortOrder: (prefs.defaultBooksSortOrder as 'asc' | 'desc') || 'asc',
		booksPerPage: prefs.booksPerPage || 24,
		readerFontFamily: prefs.readerFontFamily || 'system',
		readerFontSize: prefs.readerFontSize || 16,
		readerLineHeight: prefs.readerLineHeight || 1.6,
		readerTheme: (prefs.readerTheme as 'auto' | 'light' | 'dark' | 'sepia') || 'auto',
		emailNotifications: prefs.emailNotifications || false,
		goalReminders: prefs.goalReminders ?? true,
		ntfyTopic: prefs.ntfyTopic || null,
		ntfyEnabled: prefs.ntfyEnabled || false,
		notifyBookAdded: prefs.notifyBookAdded ?? true,
		notifyBookCompleted: prefs.notifyBookCompleted ?? true,
		notifyGoalReached: prefs.notifyGoalReached ?? true,
		notifySeriesCompleted: prefs.notifySeriesCompleted ?? true,
		sidebarCollapsed: prefs.sidebarCollapsed || false
	};
}

/**
 * Create default preferences for a user
 */
async function createDefaultPreferences(userId: number): Promise<void> {
	const now = new Date().toISOString();
	await db.insert(userPreferences).values({
		userId,
		theme: 'system',
		accentColor: '#3b82f6',
		defaultBooksView: 'grid',
		defaultBooksSort: 'title',
		defaultBooksSortOrder: 'asc',
		booksPerPage: 24,
		readerFontFamily: 'system',
		readerFontSize: 16,
		readerLineHeight: 1.6,
		readerTheme: 'auto',
		emailNotifications: false,
		goalReminders: true,
		sidebarCollapsed: false,
		createdAt: now,
		updatedAt: now
	}).onConflictDoNothing();
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
	userId: number,
	updates: Partial<UserPreferencesData>
): Promise<UserPreferencesData> {
	// Ensure preferences row exists
	const existing = await db
		.select({ id: userPreferences.id })
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);

	const now = new Date().toISOString();

	// Build update object
	const updateData: Partial<NewUserPreference> = {
		updatedAt: now
	};

	if (updates.theme !== undefined) updateData.theme = updates.theme;
	if (updates.accentColor !== undefined) updateData.accentColor = updates.accentColor;
	if (updates.dashboardWidgets !== undefined) {
		updateData.dashboardWidgets = updates.dashboardWidgets ? JSON.stringify(updates.dashboardWidgets) : null;
	}
	if (updates.dashboardConfig !== undefined) {
		updateData.dashboardConfig = updates.dashboardConfig ? JSON.stringify(updates.dashboardConfig) : null;
	}
	if (updates.defaultBooksView !== undefined) updateData.defaultBooksView = updates.defaultBooksView;
	if (updates.defaultBooksSort !== undefined) updateData.defaultBooksSort = updates.defaultBooksSort;
	if (updates.defaultBooksSortOrder !== undefined) updateData.defaultBooksSortOrder = updates.defaultBooksSortOrder;
	if (updates.booksPerPage !== undefined) updateData.booksPerPage = updates.booksPerPage;
	if (updates.readerFontFamily !== undefined) updateData.readerFontFamily = updates.readerFontFamily;
	if (updates.readerFontSize !== undefined) updateData.readerFontSize = updates.readerFontSize;
	if (updates.readerLineHeight !== undefined) updateData.readerLineHeight = updates.readerLineHeight;
	if (updates.readerTheme !== undefined) updateData.readerTheme = updates.readerTheme;
	if (updates.emailNotifications !== undefined) updateData.emailNotifications = updates.emailNotifications;
	if (updates.goalReminders !== undefined) updateData.goalReminders = updates.goalReminders;
	if (updates.sidebarCollapsed !== undefined) updateData.sidebarCollapsed = updates.sidebarCollapsed;
	// ntfy notification preferences
	if (updates.ntfyTopic !== undefined) updateData.ntfyTopic = updates.ntfyTopic;
	if (updates.ntfyEnabled !== undefined) updateData.ntfyEnabled = updates.ntfyEnabled;
	if (updates.notifyBookAdded !== undefined) updateData.notifyBookAdded = updates.notifyBookAdded;
	if (updates.notifyBookCompleted !== undefined) updateData.notifyBookCompleted = updates.notifyBookCompleted;
	if (updates.notifyGoalReached !== undefined) updateData.notifyGoalReached = updates.notifyGoalReached;
	if (updates.notifySeriesCompleted !== undefined) updateData.notifySeriesCompleted = updates.notifySeriesCompleted;

	if (existing.length === 0) {
		// Insert
		await db.insert(userPreferences).values({
			userId,
			...DEFAULT_PREFERENCES,
			...updateData,
			dashboardWidgets: updateData.dashboardWidgets || null,
			dashboardConfig: updateData.dashboardConfig || null,
			createdAt: now
		});
	} else {
		// Update
		await db.update(userPreferences)
			.set(updateData)
			.where(eq(userPreferences.userId, userId));
	}

	return getUserPreferences(userId);
}

/**
 * Get a single preference value
 */
export async function getPreference<K extends keyof UserPreferencesData>(
	userId: number,
	key: K
): Promise<UserPreferencesData[K]> {
	const prefs = await getUserPreferences(userId);
	return prefs[key];
}

/**
 * Set a single preference value
 */
export async function setPreference<K extends keyof UserPreferencesData>(
	userId: number,
	key: K,
	value: UserPreferencesData[K]
): Promise<void> {
	await updateUserPreferences(userId, { [key]: value } as Partial<UserPreferencesData>);
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(userId: number): Promise<UserPreferencesData> {
	await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
	await createDefaultPreferences(userId);
	return { ...DEFAULT_PREFERENCES };
}

/**
 * Get theme for a user (for SSR)
 */
export async function getUserTheme(userId: number): Promise<'light' | 'dark' | 'system'> {
	const result = await db
		.select({ theme: userPreferences.theme })
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);

	return (result[0]?.theme as 'light' | 'dark' | 'system') || 'system';
}

/**
 * Get sidebar collapsed state
 */
export async function getSidebarState(userId: number): Promise<boolean> {
	const result = await db
		.select({ collapsed: userPreferences.sidebarCollapsed })
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);

	return result[0]?.collapsed || false;
}

/**
 * Set sidebar collapsed state
 */
export async function setSidebarState(userId: number, collapsed: boolean): Promise<void> {
	await updateUserPreferences(userId, { sidebarCollapsed: collapsed });
}

// ============================================
// Dashboard Configuration Functions
// ============================================

/**
 * Get user's dashboard configuration
 * Returns default config if user hasn't customized it
 */
export async function getDashboardConfig(userId: number): Promise<DashboardConfig> {
	const prefs = await getUserPreferences(userId);
	return prefs.dashboardConfig || { ...DEFAULT_DASHBOARD_CONFIG };
}

/**
 * Save user's dashboard configuration
 */
export async function saveDashboardConfig(userId: number, config: DashboardConfig): Promise<void> {
	await updateUserPreferences(userId, { dashboardConfig: config });
}

/**
 * Get sorted enabled sections from dashboard config
 * Returns sections in display order, filtered to only enabled ones
 */
export function getEnabledSections(config: DashboardConfig): DashboardSection[] {
	return config.sections
		.filter(section => section.enabled)
		.sort((a, b) => a.order - b.order);
}

/**
 * Update a single section in the dashboard config
 */
export async function updateDashboardSection(
	userId: number,
	sectionId: DashboardSectionId,
	updates: Partial<Omit<DashboardSection, 'id'>>
): Promise<DashboardConfig> {
	const config = await getDashboardConfig(userId);

	const sectionIndex = config.sections.findIndex(s => s.id === sectionId);
	if (sectionIndex === -1) {
		throw new Error(`Section '${sectionId}' not found in dashboard config`);
	}

	config.sections[sectionIndex] = {
		...config.sections[sectionIndex],
		...updates
	};

	await saveDashboardConfig(userId, config);
	return config;
}

/**
 * Reorder dashboard sections
 * Takes an array of section IDs in the new order
 */
export async function reorderDashboardSections(
	userId: number,
	sectionOrder: DashboardSectionId[]
): Promise<DashboardConfig> {
	const config = await getDashboardConfig(userId);

	// Update order based on position in array
	sectionOrder.forEach((sectionId, index) => {
		const section = config.sections.find(s => s.id === sectionId);
		if (section) {
			section.order = index;
		}
	});

	// Sort sections by new order
	config.sections.sort((a, b) => a.order - b.order);

	await saveDashboardConfig(userId, config);
	return config;
}

/**
 * Toggle a section's enabled state
 */
export async function toggleDashboardSection(
	userId: number,
	sectionId: DashboardSectionId,
	enabled?: boolean
): Promise<DashboardConfig> {
	const config = await getDashboardConfig(userId);

	const section = config.sections.find(s => s.id === sectionId);
	if (!section) {
		throw new Error(`Section '${sectionId}' not found in dashboard config`);
	}

	section.enabled = enabled ?? !section.enabled;

	await saveDashboardConfig(userId, config);
	return config;
}

/**
 * Configure smart collection section
 */
export async function configureSmartCollectionSection(
	userId: number,
	options: { shelfId?: number; customFilter?: FilterConfig }
): Promise<DashboardConfig> {
	const config = await getDashboardConfig(userId);

	const section = config.sections.find(s => s.id === 'smart-collection');
	if (!section) {
		throw new Error("Smart collection section not found in dashboard config");
	}

	// Clear previous config and set new one
	section.shelfId = options.shelfId;
	section.customFilter = options.customFilter;
	section.enabled = true; // Auto-enable when configured

	await saveDashboardConfig(userId, config);
	return config;
}

/**
 * Reset dashboard config to defaults
 */
export async function resetDashboardConfig(userId: number): Promise<DashboardConfig> {
	// Deep copy the default config to avoid mutating the original
	const defaultConfig: DashboardConfig = {
		sections: DEFAULT_DASHBOARD_CONFIG.sections.map(s => ({ ...s }))
	};
	await saveDashboardConfig(userId, defaultConfig);
	return defaultConfig;
}
