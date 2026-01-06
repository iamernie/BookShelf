<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Settings,
		Palette,
		Layout,
		BookOpen,
		Bell,
		RotateCcw,
		Save,
		Loader2,
		Check,
		Sun,
		Moon,
		Monitor,
		Grid,
		List,
		Table,
		Shield,
		Link,
		Unlink,
		ExternalLink,
		Users,
		UserPlus,
		Trash2,
		Eye,
		Edit,
		KeyRound,
		AlertCircle,
		Tablet,
		Copy,
		RefreshCw,
		Clock,
		Info,
		BookOpen as BookIcon,
		Smartphone,
		Power,
		Tag
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import { theme as themeStore, type Theme } from '$lib/stores/theme';

	let { data } = $props();

	let preferences = $state({ ...data.preferences });

	// Library sharing state
	let showShareModal = $state(false);
	let selectedUserId = $state<number | null>(null);
	let selectedPermission = $state<'read' | 'read_write' | 'full'>('read');
	let sharingInProgress = $state(false);
	let removingShareId = $state<number | null>(null);

	const permissionLabels: Record<string, { label: string; description: string; icon: typeof Eye }> = {
		read: { label: 'View Only', description: 'Can browse and read books', icon: Eye },
		read_write: { label: 'Can Edit', description: 'Can edit book details', icon: Edit },
		full: { label: 'Full Access', description: 'Can edit and delete books', icon: KeyRound }
	};

	async function shareLibrary() {
		if (!selectedUserId) {
			toasts.error('Please select a user');
			return;
		}

		sharingInProgress = true;
		try {
			const res = await fetch('/api/library/shares', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: selectedUserId, permission: selectedPermission })
			});

			if (res.ok) {
				toasts.success('Library shared successfully');
				showShareModal = false;
				selectedUserId = null;
				selectedPermission = 'read';
				invalidateAll();
			} else {
				const result = await res.json();
				toasts.error(result.message || 'Failed to share library');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			sharingInProgress = false;
		}
	}

	async function removeLibraryShare(userId: number) {
		if (!confirm('Are you sure you want to stop sharing your library with this user?')) {
			return;
		}

		removingShareId = userId;
		try {
			const res = await fetch(`/api/library/shares?userId=${userId}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				toasts.success('Library share removed');
				invalidateAll();
			} else {
				toasts.error('Failed to remove share');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			removingShareId = null;
		}
	}

	async function updateSharePermission(userId: number, permission: string) {
		try {
			const res = await fetch('/api/library/shares', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, permission })
			});

			if (res.ok) {
				toasts.success('Permission updated');
				invalidateAll();
			} else {
				toasts.error('Failed to update permission');
			}
		} catch {
			toasts.error('An error occurred');
		}
	}
	let saving = $state(false);
	let saved = $state(false);
	let resetting = $state(false);
	let unlinkingProvider = $state<number | null>(null);
	let testingNotification = $state(false);
	let notificationTestResult = $state<{ success: boolean; error?: string } | null>(null);

	// KOReader sync state
	let koreaderLoading = $state(true);
	let koreaderSaving = $state(false);
	let koreaderSettings = $state<{
		configured: boolean;
		username: string | null;
		password: string | null;
		syncEnabled: boolean;
		progressEntries: number;
		recentActivity: Array<{
			id: number;
			documentHash: string;
			percentage: number | null;
			device: string | null;
			timestamp: number | null;
			updatedAt: string | null;
			bookId: number | null;
			bookTitle: string | null;
		}>;
	} | null>(null);
	let koreaderUsername = $state('');
	let koreaderPassword = $state('');
	let showKoreaderPassword = $state(false);
	let linkingProgressId = $state<number | null>(null);
	let showLinkModal = $state(false);
	let linkSearchQuery = $state('');
	let linkSearchResults = $state<Array<{ id: number; title: string; author?: string }>>([]);
	let linkSearching = $state(false);
	let deletingProgressId = $state<number | null>(null);

	// Format relative time for recent activity
	function formatRelativeTime(dateStr: string | null, timestamp: number | null): string {
		let date: Date;
		if (dateStr) {
			date = new Date(dateStr);
		} else if (timestamp) {
			date = new Date(timestamp * 1000);
		} else {
			return 'Unknown';
		}

		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	// Load KOReader settings
	async function loadKoreaderSettings() {
		try {
			const res = await fetch('/api/koreader/settings');
			if (res.ok) {
				koreaderSettings = await res.json();
				if (koreaderSettings?.username) {
					koreaderUsername = koreaderSettings.username;
				}
				if (koreaderSettings?.password) {
					koreaderPassword = koreaderSettings.password;
				}
			}
		} catch {
			// Failed to load
		} finally {
			koreaderLoading = false;
		}
	}

	// Save KOReader credentials
	async function saveKoreaderCredentials() {
		if (!koreaderUsername || koreaderUsername.length < 3) {
			toasts.error('Username must be at least 3 characters');
			return;
		}
		if (!koreaderPassword || koreaderPassword.length < 6) {
			toasts.error('Password must be at least 6 characters');
			return;
		}

		koreaderSaving = true;
		try {
			const res = await fetch('/api/koreader/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: koreaderUsername, password: koreaderPassword })
			});

			if (res.ok) {
				toasts.success('KOReader credentials saved');
				await loadKoreaderSettings();
			} else {
				const result = await res.json();
				toasts.error(result.message || 'Failed to save credentials');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			koreaderSaving = false;
		}
	}

	// Toggle KOReader sync
	async function toggleKoreaderSync() {
		if (!koreaderSettings) return;

		try {
			const res = await fetch('/api/koreader/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ syncEnabled: !koreaderSettings.syncEnabled })
			});

			if (res.ok) {
				koreaderSettings.syncEnabled = !koreaderSettings.syncEnabled;
				toasts.success(koreaderSettings.syncEnabled ? 'Sync enabled' : 'Sync disabled');
			} else {
				toasts.error('Failed to update sync setting');
			}
		} catch {
			toasts.error('An error occurred');
		}
	}

	// Delete KOReader credentials
	async function deleteKoreaderCredentials() {
		if (!confirm('Are you sure you want to remove your KOReader credentials? This will stop syncing progress from your e-reader.')) {
			return;
		}

		try {
			const res = await fetch('/api/koreader/settings', { method: 'DELETE' });

			if (res.ok) {
				koreaderSettings = { configured: false, username: null, password: null, syncEnabled: false, progressEntries: 0, recentActivity: [] };
				koreaderUsername = '';
				koreaderPassword = '';
				toasts.success('KOReader credentials removed');
			} else {
				toasts.error('Failed to remove credentials');
			}
		} catch {
			toasts.error('An error occurred');
		}
	}

	// Copy to clipboard
	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			toasts.success(`${label} copied to clipboard`);
		} catch {
			toasts.error('Failed to copy');
		}
	}

	// Open link modal for an unlinked progress entry
	function openLinkModal(progressId: number) {
		linkingProgressId = progressId;
		linkSearchQuery = '';
		linkSearchResults = [];
		showLinkModal = true;
	}

	// Search for books to link to
	async function searchBooksForLink() {
		if (!linkSearchQuery.trim()) {
			linkSearchResults = [];
			return;
		}

		linkSearching = true;
		try {
			const res = await fetch(`/api/books?q=${encodeURIComponent(linkSearchQuery)}&limit=10`);
			if (res.ok) {
				const result = await res.json();
				linkSearchResults = result.books.map((b: { id: number; title: string; author?: string }) => ({
					id: b.id,
					title: b.title,
					author: b.author
				}));
			}
		} catch {
			toasts.error('Failed to search books');
		} finally {
			linkSearching = false;
		}
	}

	// Link progress entry to a book
	async function linkProgressToBook(bookId: number) {
		if (!linkingProgressId) return;

		try {
			const res = await fetch(`/api/koreader/progress/${linkingProgressId}/link`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bookId })
			});

			if (res.ok) {
				const result = await res.json();
				toasts.success(`Linked to "${result.bookTitle}"`);
				showLinkModal = false;
				linkingProgressId = null;
				// Refresh settings to show updated activity
				await loadKoreaderSettings();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to link');
			}
		} catch {
			toasts.error('An error occurred');
		}
	}

	// Delete a progress entry
	async function deleteProgressEntry(progressId: number) {
		if (!confirm('Delete this sync entry? This will remove the reading progress for this document.')) {
			return;
		}

		deletingProgressId = progressId;
		try {
			const res = await fetch(`/api/koreader/progress/${progressId}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				toasts.success('Sync entry deleted');
				// Refresh settings to show updated activity
				await loadKoreaderSettings();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to delete');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			deletingProgressId = null;
		}
	}

	// Load KOReader settings on mount
	$effect(() => {
		loadKoreaderSettings();
	});

	// Kobo sync state
	let koboLoading = $state(true);
	let koboSaving = $state(false);
	let koboSettings = $state<{
		configured: boolean;
		token: string | null;
		syncEnabled: boolean;
		syncUrl?: string;
		devices?: Array<{
			id: number;
			deviceId: string;
			deviceModel: string | null;
			lastSyncAt: string | null;
		}>;
	} | null>(null);
	let showKoboToken = $state(false);

	// Load Kobo settings
	async function loadKoboSettings() {
		try {
			const res = await fetch('/api/kobo/settings');
			if (res.ok) {
				koboSettings = await res.json();
			} else if (res.status === 404) {
				koboSettings = { configured: false, token: null, syncEnabled: false };
			}
		} catch {
			// Failed to load
		} finally {
			koboLoading = false;
		}
	}

	// Enable Kobo sync
	async function enableKoboSync() {
		koboSaving = true;
		try {
			const res = await fetch('/api/kobo/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			if (res.ok) {
				toasts.success('Kobo sync enabled');
				await loadKoboSettings();
			} else {
				const result = await res.json();
				toasts.error(result.message || 'Failed to enable Kobo sync');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			koboSaving = false;
		}
	}

	// Toggle Kobo sync
	async function toggleKoboSync() {
		if (!koboSettings) return;

		try {
			const res = await fetch('/api/kobo/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ syncEnabled: !koboSettings.syncEnabled })
			});

			if (res.ok) {
				koboSettings.syncEnabled = !koboSettings.syncEnabled;
				toasts.success(koboSettings.syncEnabled ? 'Sync enabled' : 'Sync disabled');
			} else {
				toasts.error('Failed to update sync setting');
			}
		} catch {
			toasts.error('An error occurred');
		}
	}

	// Regenerate Kobo token
	async function regenerateKoboToken() {
		if (!confirm('Are you sure? You will need to reconfigure your Kobo device with the new URL.')) {
			return;
		}

		try {
			const res = await fetch('/api/kobo/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ regenerateToken: true })
			});

			if (res.ok) {
				toasts.success('Token regenerated');
				await loadKoboSettings();
			} else {
				toasts.error('Failed to regenerate token');
			}
		} catch {
			toasts.error('An error occurred');
		}
	}

	// Delete Kobo settings
	async function deleteKoboSettings() {
		if (!confirm('Are you sure you want to disable Kobo sync? Your Kobo device will no longer be able to sync with BookShelf.')) {
			return;
		}

		try {
			const res = await fetch('/api/kobo/settings', { method: 'DELETE' });

			if (res.ok) {
				koboSettings = { configured: false, token: null, syncEnabled: false };
				toasts.success('Kobo sync disabled');
			} else {
				toasts.error('Failed to disable Kobo sync');
			}
		} catch {
			toasts.error('An error occurred');
		}
	}

	// Load Kobo settings on mount
	$effect(() => {
		loadKoboSettings();
	});

	// Theme options
	const themeOptions = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];

	// View options
	const viewOptions = [
		{ value: 'grid', label: 'Grid', icon: Grid },
		{ value: 'list', label: 'List', icon: List },
		{ value: 'table', label: 'Table', icon: Table }
	];

	// Sort options
	const sortOptions = [
		{ value: 'title', label: 'Title' },
		{ value: 'author', label: 'Author' },
		{ value: 'rating', label: 'Rating' },
		{ value: 'releaseDate', label: 'Release Date' },
		{ value: 'createdAt', label: 'Date Added' },
		{ value: 'completedDate', label: 'Date Completed' }
	];

	// Reader theme options
	const readerThemeOptions = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'sepia', label: 'Sepia' }
	];

	// Accent color presets
	const accentPresets = [
		'#3b82f6', // Blue
		'#8b5cf6', // Purple
		'#ec4899', // Pink
		'#ef4444', // Red
		'#f59e0b', // Amber
		'#22c55e', // Green
		'#06b6d4', // Cyan
		'#6366f1'  // Indigo
	];

	async function savePreferences() {
		saving = true;
		saved = false;

		try {
			const res = await fetch('/api/account/preferences', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(preferences)
			});

			if (res.ok) {
				saved = true;
				toasts.success('Preferences saved');

				// Update theme store if theme changed
				if (preferences.theme) {
					themeStore.set(preferences.theme as Theme);
				}

				invalidateAll();
				setTimeout(() => saved = false, 2000);
			} else {
				const result = await res.json();
				toasts.error(result.message || 'Failed to save preferences');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			saving = false;
		}
	}

	async function resetPreferences() {
		resetting = true;

		try {
			const res = await fetch('/api/account/preferences', {
				method: 'DELETE'
			});

			if (res.ok) {
				const result = await res.json();
				preferences = result.preferences;
				toasts.success('Preferences reset to defaults');
				themeStore.set('system');
				invalidateAll();
			} else {
				toasts.error('Failed to reset preferences');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			resetting = false;
		}
	}

	function handleThemeChange(value: string) {
		preferences.theme = value as Theme;
		// Immediately apply theme for preview
		themeStore.set(value as Theme);
	}

	async function unlinkOidcAccount(providerId: number) {
		if (!confirm('Are you sure you want to unlink this account? You will need to link it again to use it for sign-in.')) {
			return;
		}

		unlinkingProvider = providerId;

		try {
			const res = await fetch('/api/auth/oidc/unlink', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ providerId })
			});

			if (!res.ok) {
				toasts.error('Failed to unlink account');
				return;
			}

			toasts.success('Account unlinked');
			invalidateAll();
		} catch {
			toasts.error('An error occurred');
		} finally {
			unlinkingProvider = null;
		}
	}

	async function sendTestNotification() {
		// First save preferences to ensure topic is stored
		await savePreferences();

		testingNotification = true;
		notificationTestResult = null;

		try {
			const res = await fetch('/api/notifications/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'user' })
			});

			const result = await res.json();
			notificationTestResult = result;

			if (result.success) {
				toasts.success('Test notification sent!');
			} else {
				toasts.error(result.error || 'Failed to send test notification');
			}
		} catch {
			notificationTestResult = { success: false, error: 'Failed to send test notification' };
			toasts.error('An error occurred');
		} finally {
			testingNotification = false;
		}
	}
</script>

<svelte:head>
	<title>Settings | My Account</title>
</svelte:head>

<div class="container mx-auto px-4 py-6 max-w-4xl">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div class="flex items-center gap-3">
			<Settings class="w-6 h-6" style="color: var(--accent);" />
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Settings</h1>
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="btn-ghost flex items-center gap-2"
				onclick={resetPreferences}
				disabled={resetting}
			>
				{#if resetting}
					<Loader2 class="w-4 h-4 animate-spin" />
				{:else}
					<RotateCcw class="w-4 h-4" />
				{/if}
				Reset
			</button>
			<button
				type="button"
				class="btn-primary flex items-center gap-2"
				onclick={savePreferences}
				disabled={saving}
			>
				{#if saving}
					<Loader2 class="w-4 h-4 animate-spin" />
				{:else if saved}
					<Check class="w-4 h-4" />
				{:else}
					<Save class="w-4 h-4" />
				{/if}
				{saved ? 'Saved!' : 'Save'}
			</button>
		</div>
	</div>

	<!-- Quick Nav -->
	<div class="flex gap-2 mb-6">
		<a href="/account" class="px-4 py-2 rounded-lg font-medium" style="background-color: var(--bg-tertiary); color: var(--text-secondary);">
			Profile
		</a>
		<a href="/account/settings" class="px-4 py-2 rounded-lg font-medium" style="background-color: var(--accent); color: white;">
			Settings
		</a>
	</div>

	<div class="space-y-6">
		<!-- Appearance Section -->
		<section class="card p-6">
			<div class="flex items-center gap-2 mb-4">
				<Palette class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Appearance</h2>
			</div>

			<!-- Theme -->
			<div class="mb-6">
				<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Theme</label>
				<div class="flex gap-2">
					{#each themeOptions as option}
						{@const Icon = option.icon}
						<button
							type="button"
							class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all"
							style="background-color: {preferences.theme === option.value ? 'var(--accent)' : 'var(--bg-tertiary)'};
							       border-color: {preferences.theme === option.value ? 'var(--accent)' : 'var(--border-color)'};
							       color: {preferences.theme === option.value ? 'white' : 'var(--text-secondary)'};"
							onclick={() => handleThemeChange(option.value)}
						>
							<Icon class="w-4 h-4" />
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Accent Color -->
			<div>
				<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Accent Color</label>
				<div class="flex items-center gap-3">
					<div class="flex gap-2">
						{#each accentPresets as color}
							<button
								type="button"
								class="w-8 h-8 rounded-full transition-transform hover:scale-110"
								style="background-color: {color}; outline: {preferences.accentColor === color ? '2px solid ' + color : 'none'}; outline-offset: 2px;"
								onclick={() => preferences.accentColor = color}
							/>
						{/each}
					</div>
					<input
						type="color"
						class="w-8 h-8 rounded cursor-pointer"
						bind:value={preferences.accentColor}
					/>
				</div>
			</div>
		</section>

		<!-- Books Display Section -->
		<section class="card p-6">
			<div class="flex items-center gap-2 mb-4">
				<Layout class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Books Display</h2>
			</div>

			<!-- Default View -->
			<div class="mb-6">
				<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Default View</label>
				<div class="flex gap-2">
					{#each viewOptions as option}
						{@const Icon = option.icon}
						<button
							type="button"
							class="flex items-center gap-2 px-4 py-2 rounded-lg border transition-all"
							style="background-color: {preferences.defaultBooksView === option.value ? 'var(--accent)' : 'var(--bg-tertiary)'};
							       border-color: {preferences.defaultBooksView === option.value ? 'var(--accent)' : 'var(--border-color)'};
							       color: {preferences.defaultBooksView === option.value ? 'white' : 'var(--text-secondary)'};"
							onclick={() => preferences.defaultBooksView = option.value as 'grid' | 'list' | 'table'}
						>
							<Icon class="w-4 h-4" />
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4 mb-6">
				<!-- Default Sort -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Default Sort</label>
					<select class="form-input w-full" bind:value={preferences.defaultBooksSort}>
						{#each sortOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<!-- Sort Order -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Sort Order</label>
					<select class="form-input w-full" bind:value={preferences.defaultBooksSortOrder}>
						<option value="asc">Ascending (A-Z, 1-9)</option>
						<option value="desc">Descending (Z-A, 9-1)</option>
					</select>
				</div>
			</div>

			<!-- Books Per Page -->
			<div>
				<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Books Per Page: {preferences.booksPerPage}</label>
				<input
					type="range"
					min="12"
					max="100"
					step="12"
					class="w-full"
					bind:value={preferences.booksPerPage}
				/>
				<div class="flex justify-between text-xs mt-1" style="color: var(--text-muted);">
					<span>12</span>
					<span>100</span>
				</div>
			</div>
		</section>

		<!-- Reader Section -->
		<section class="card p-6">
			<div class="flex items-center gap-2 mb-4">
				<BookOpen class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Reader</h2>
			</div>

			<div class="grid grid-cols-2 gap-4 mb-6">
				<!-- Reader Theme -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Reader Theme</label>
					<select class="form-input w-full" bind:value={preferences.readerTheme}>
						{#each readerThemeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<!-- Font Family -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Font Family</label>
					<select class="form-input w-full" bind:value={preferences.readerFontFamily}>
						<option value="system">System Default</option>
						<option value="serif">Serif</option>
						<option value="sans-serif">Sans Serif</option>
						<option value="monospace">Monospace</option>
					</select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<!-- Font Size -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Font Size: {preferences.readerFontSize}px</label>
					<input
						type="range"
						min="10"
						max="32"
						step="1"
						class="w-full"
						bind:value={preferences.readerFontSize}
					/>
				</div>

				<!-- Line Height -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Line Height: {preferences.readerLineHeight}</label>
					<input
						type="range"
						min="1"
						max="2.5"
						step="0.1"
						class="w-full"
						bind:value={preferences.readerLineHeight}
					/>
				</div>
			</div>
		</section>

		<!-- Notifications Section -->
		<section class="card p-6">
			<div class="flex items-center gap-2 mb-4">
				<Bell class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Notifications</h2>
			</div>

			<div class="space-y-4">
				<label class="flex items-center justify-between p-3 rounded-lg cursor-pointer" style="background-color: var(--bg-tertiary);">
					<div>
						<p class="font-medium" style="color: var(--text-primary);">Goal Reminders</p>
						<p class="text-sm" style="color: var(--text-muted);">Get reminders about your reading goals</p>
					</div>
					<input
						type="checkbox"
						class="toggle"
						bind:checked={preferences.goalReminders}
					/>
				</label>

				<label class="flex items-center justify-between p-3 rounded-lg cursor-pointer" style="background-color: var(--bg-tertiary);">
					<div>
						<p class="font-medium" style="color: var(--text-primary);">Email Notifications</p>
						<p class="text-sm" style="color: var(--text-muted);">Receive updates via email</p>
					</div>
					<input
						type="checkbox"
						class="toggle"
						bind:checked={preferences.emailNotifications}
					/>
				</label>
			</div>

			<!-- ntfy Push Notifications -->
			{#if data.ntfyEnabled}
				<div class="mt-6 pt-6 border-t" style="border-color: var(--border-color);">
					<h3 class="text-md font-semibold mb-4" style="color: var(--text-primary);">Push Notifications (ntfy)</h3>
					<p class="text-sm mb-4" style="color: var(--text-muted);">
						Receive push notifications on your devices via <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer" class="underline" style="color: var(--accent);">ntfy</a>.
					</p>

					<div class="space-y-4">
						<!-- ntfy Topic -->
						<div>
							<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Your ntfy Topic</label>
							<input
								type="text"
								class="form-input w-full"
								placeholder="my-bookshelf-alerts"
								bind:value={preferences.ntfyTopic}
							/>
							<p class="text-xs mt-1" style="color: var(--text-muted);">
								Subscribe to this topic in your ntfy app to receive notifications
							</p>
						</div>

						<!-- Enable/Disable Toggle -->
						<label class="flex items-center justify-between p-3 rounded-lg cursor-pointer" style="background-color: var(--bg-tertiary);">
							<div>
								<p class="font-medium" style="color: var(--text-primary);">Enable Push Notifications</p>
								<p class="text-sm" style="color: var(--text-muted);">Master toggle for ntfy notifications</p>
							</div>
							<input
								type="checkbox"
								class="toggle"
								bind:checked={preferences.ntfyEnabled}
								disabled={!preferences.ntfyTopic}
							/>
						</label>

						{#if preferences.ntfyEnabled && preferences.ntfyTopic}
							<!-- Notification Types -->
							<div class="space-y-2">
								<p class="text-sm font-medium" style="color: var(--text-secondary);">Notify me when...</p>

								<label class="flex items-center justify-between p-3 rounded-lg cursor-pointer" style="background-color: var(--bg-tertiary);">
									<div>
										<p class="font-medium" style="color: var(--text-primary);">Book Added</p>
										<p class="text-sm" style="color: var(--text-muted);">A new book is added to your library</p>
									</div>
									<input
										type="checkbox"
										class="toggle"
										bind:checked={preferences.notifyBookAdded}
									/>
								</label>

								<label class="flex items-center justify-between p-3 rounded-lg cursor-pointer" style="background-color: var(--bg-tertiary);">
									<div>
										<p class="font-medium" style="color: var(--text-primary);">Book Completed</p>
										<p class="text-sm" style="color: var(--text-muted);">You mark a book as finished</p>
									</div>
									<input
										type="checkbox"
										class="toggle"
										bind:checked={preferences.notifyBookCompleted}
									/>
								</label>

								<label class="flex items-center justify-between p-3 rounded-lg cursor-pointer" style="background-color: var(--bg-tertiary);">
									<div>
										<p class="font-medium" style="color: var(--text-primary);">Reading Goal Reached</p>
										<p class="text-sm" style="color: var(--text-muted);">You achieve a reading goal</p>
									</div>
									<input
										type="checkbox"
										class="toggle"
										bind:checked={preferences.notifyGoalReached}
									/>
								</label>

								<label class="flex items-center justify-between p-3 rounded-lg cursor-pointer" style="background-color: var(--bg-tertiary);">
									<div>
										<p class="font-medium" style="color: var(--text-primary);">Series Completed</p>
										<p class="text-sm" style="color: var(--text-muted);">You finish all books in a series</p>
									</div>
									<input
										type="checkbox"
										class="toggle"
										bind:checked={preferences.notifySeriesCompleted}
									/>
								</label>
							</div>

							<!-- Test Notification Button -->
							<div class="pt-4">
								<button
									type="button"
									class="btn-ghost flex items-center gap-2"
									onclick={sendTestNotification}
									disabled={testingNotification}
								>
									{#if testingNotification}
										<Loader2 class="w-4 h-4 animate-spin" />
										Sending...
									{:else}
										<Bell class="w-4 h-4" />
										Send Test Notification
									{/if}
								</button>
								{#if notificationTestResult}
									<p class="text-sm mt-2" style="color: {notificationTestResult.success ? '#22c55e' : '#ef4444'};">
										{notificationTestResult.success ? 'Test notification sent!' : notificationTestResult.error}
									</p>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</section>

		<!-- Connected Accounts Section -->
		{#if data.oidcLinks?.length > 0 || data.availableProviders?.length > 0}
			<section class="card p-6">
				<div class="flex items-center gap-2 mb-4">
					<Shield class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Connected Accounts</h2>
				</div>

				{#if data.justLinked}
					<div class="mb-4 p-3 rounded-lg flex items-center gap-2" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;">
						<Check class="w-4 h-4" />
						<span class="text-sm">Account linked successfully!</span>
					</div>
				{:else if data.alreadyLinked}
					<div class="mb-4 p-3 rounded-lg flex items-center gap-2" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
						<Check class="w-4 h-4" />
						<span class="text-sm">This account is already linked.</span>
					</div>
				{:else if data.linkingError}
					<div class="mb-4 p-3 rounded-lg flex items-center gap-2" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
						<AlertCircle class="w-4 h-4" />
						<span class="text-sm">{data.linkingError}</span>
					</div>
				{/if}

				<p class="text-sm mb-4" style="color: var(--text-muted);">
					Link external identity providers to sign in without a password.
				</p>

				<div class="space-y-3">
					<!-- Linked Accounts -->
					{#each data.oidcLinks || [] as link}
						<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<div class="flex items-center gap-3">
								{#if link.providerIcon}
									<img src={link.providerIcon} alt="" class="w-8 h-8 rounded" />
								{:else}
									<div
										class="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
										style="background: {link.providerColor || 'var(--accent)'};"
									>
										{link.providerName.charAt(0)}
									</div>
								{/if}
								<div>
									<p class="font-medium" style="color: var(--text-primary);">{link.providerName}</p>
									{#if link.oidcEmail}
										<p class="text-xs" style="color: var(--text-muted);">{link.oidcEmail}</p>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-xs px-2 py-1 rounded-full" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;">
									Linked
								</span>
								<button
									type="button"
									class="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
									title="Unlink account"
									onclick={() => unlinkOidcAccount(link.providerId)}
									disabled={unlinkingProvider === link.providerId}
								>
									{#if unlinkingProvider === link.providerId}
										<Loader2 class="w-4 h-4 animate-spin" style="color: var(--text-muted);" />
									{:else}
										<Unlink class="w-4 h-4 text-red-400" />
									{/if}
								</button>
							</div>
						</div>
					{/each}

					<!-- Available Providers to Link -->
					{#each data.availableProviders || [] as provider}
						<a
							href="/auth/oidc/{provider.slug}"
							class="flex items-center justify-between p-3 rounded-lg transition-colors hover:opacity-90"
							style="background-color: var(--bg-tertiary); border: 1px dashed var(--border-color);"
						>
							<div class="flex items-center gap-3">
								{#if provider.iconUrl}
									<img src={provider.iconUrl} alt="" class="w-8 h-8 rounded opacity-50" />
								{:else}
									<div
										class="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm opacity-50"
										style="background: {provider.buttonColor || 'var(--accent)'};"
									>
										{provider.name.charAt(0)}
									</div>
								{/if}
								<div>
									<p class="font-medium" style="color: var(--text-primary);">{provider.name}</p>
									<p class="text-xs" style="color: var(--text-muted);">Click to link</p>
								</div>
							</div>
							<Link class="w-4 h-4" style="color: var(--text-muted);" />
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<!-- KOReader Sync Section -->
		<section class="card p-6">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<Tablet class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="text-lg font-semibold" style="color: var(--text-primary);">KOReader Sync</h2>
				</div>
				{#if koreaderSettings?.configured}
					<button
						type="button"
						class="text-sm px-3 py-1.5 rounded-lg transition-colors"
						style="background-color: {koreaderSettings.syncEnabled ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {koreaderSettings.syncEnabled ? 'white' : 'var(--text-muted)'};"
						onclick={toggleKoreaderSync}
					>
						{koreaderSettings.syncEnabled ? 'Sync Enabled' : 'Sync Disabled'}
					</button>
				{/if}
			</div>

			<p class="text-sm mb-4" style="color: var(--text-muted);">
				Sync your reading progress from KOReader on your e-reader (Kobo, Kindle, etc.) to BookShelf.
			</p>

			<!-- Sync limitations info -->
			<div class="p-3 rounded-lg mb-4 flex gap-3" style="background-color: var(--bg-tertiary); border-left: 3px solid var(--accent);">
				<Info class="w-4 h-4 flex-shrink-0 mt-0.5" style="color: var(--accent);" />
				<div class="text-xs space-y-1" style="color: var(--text-muted);">
					<p><strong style="color: var(--text-secondary);">Sync Direction:</strong> KOReader → Browser works perfectly. Browser → KOReader only syncs percentage (not exact position) due to incompatible position formats.</p>
					<p><strong style="color: var(--text-secondary);">Best practice:</strong> Read a few pages on KOReader first, then browser progress updates will sync back.</p>
				</div>
			</div>

			{#if koreaderLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="w-6 h-6 animate-spin" style="color: var(--text-muted);" />
				</div>
			{:else if koreaderSettings?.configured}
				<!-- Configured - show credentials and sync URL -->
				<div class="space-y-4">
					<!-- Sync Server URL -->
					<div class="p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
						<div class="flex items-center justify-between mb-2">
							<span class="text-sm font-medium" style="color: var(--text-secondary);">Sync Server URL</span>
							<button
								type="button"
								class="p-1.5 rounded transition-colors hover:bg-black/10"
								onclick={() => copyToClipboard(`${window.location.origin}/api/koreader`, 'URL')}
								title="Copy URL"
							>
								<Copy class="w-4 h-4" style="color: var(--text-muted);" />
							</button>
						</div>
						<code class="text-sm break-all" style="color: var(--text-primary);">
							{typeof window !== 'undefined' ? `${window.location.origin}/api/koreader` : '/api/koreader'}
						</code>
					</div>

					<!-- Credentials -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
							<div class="flex items-center justify-between mb-2">
								<span class="text-sm font-medium" style="color: var(--text-secondary);">Username</span>
								<button
									type="button"
									class="p-1.5 rounded transition-colors hover:bg-black/10"
									onclick={() => copyToClipboard(koreaderSettings?.username || '', 'Username')}
									title="Copy username"
								>
									<Copy class="w-4 h-4" style="color: var(--text-muted);" />
								</button>
							</div>
							<code class="text-sm" style="color: var(--text-primary);">{koreaderSettings.username}</code>
						</div>

						<div class="p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
							<div class="flex items-center justify-between mb-2">
								<span class="text-sm font-medium" style="color: var(--text-secondary);">Password</span>
								<div class="flex items-center gap-1">
									<button
										type="button"
										class="p-1.5 rounded transition-colors hover:bg-black/10"
										onclick={() => showKoreaderPassword = !showKoreaderPassword}
										title={showKoreaderPassword ? 'Hide password' : 'Show password'}
									>
										<Eye class="w-4 h-4" style="color: var(--text-muted);" />
									</button>
									<button
										type="button"
										class="p-1.5 rounded transition-colors hover:bg-black/10"
										onclick={() => copyToClipboard(koreaderSettings?.password || '', 'Password')}
										title="Copy password"
									>
										<Copy class="w-4 h-4" style="color: var(--text-muted);" />
									</button>
								</div>
							</div>
							<code class="text-sm" style="color: var(--text-primary);">
								{showKoreaderPassword ? koreaderSettings.password : '••••••••'}
							</code>
						</div>
					</div>

					<!-- Recent Activity -->
					{#if koreaderSettings.recentActivity && koreaderSettings.recentActivity.length > 0}
						<div class="mt-4">
							<div class="flex items-center gap-2 mb-3">
								<Clock class="w-4 h-4" style="color: var(--text-muted);" />
								<span class="text-sm font-medium" style="color: var(--text-secondary);">Recent Sync Activity</span>
								<span class="text-xs px-2 py-0.5 rounded-full" style="background-color: var(--bg-tertiary); color: var(--text-muted);">
									{koreaderSettings.progressEntries} total
								</span>
							</div>
							<div class="space-y-2">
								{#each koreaderSettings.recentActivity as activity}
									<div class="flex items-center gap-3 p-2 rounded-lg text-sm" style="background-color: var(--bg-tertiary);">
										<div class="flex-shrink-0">
											{#if activity.bookId}
												<BookIcon class="w-4 h-4" style="color: var(--accent);" />
											{:else}
												<Unlink class="w-4 h-4" style="color: var(--text-muted);" />
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<div class="truncate" style="color: var(--text-primary);">
												{activity.bookTitle || `Document ${activity.documentHash.substring(0, 8)}...`}
											</div>
											<div class="flex items-center gap-2 text-xs" style="color: var(--text-muted);">
												{#if activity.percentage !== null}
													<span>{Math.round(activity.percentage * 100)}%</span>
													<span>•</span>
												{/if}
												{#if activity.device}
													<span>{activity.device}</span>
													<span>•</span>
												{/if}
												<span>{formatRelativeTime(activity.updatedAt, activity.timestamp)}</span>
											</div>
										</div>
										{#if activity.percentage !== null}
											<div class="flex-shrink-0 w-16 h-1.5 rounded-full overflow-hidden" style="background-color: var(--bg-secondary);">
												<div
													class="h-full rounded-full"
													style="width: {Math.round(activity.percentage * 100)}%; background-color: var(--accent);"
												></div>
											</div>
										{/if}
										{#if !activity.bookId}
											<button
												type="button"
												class="flex-shrink-0 text-xs px-2 py-1 rounded transition-colors flex items-center gap-1"
												style="background-color: var(--bg-secondary); color: var(--accent);"
												onclick={() => openLinkModal(activity.id)}
												title="Link to a book in your library"
											>
												<Link class="w-3 h-3" />
												Link
											</button>
										{/if}
										<button
											type="button"
											class="flex-shrink-0 p-1 rounded transition-colors hover:bg-red-500/10"
											onclick={() => deleteProgressEntry(activity.id)}
											disabled={deletingProgressId === activity.id}
											title="Delete this sync entry"
										>
											{#if deletingProgressId === activity.id}
												<Loader2 class="w-3.5 h-3.5 animate-spin" style="color: var(--text-muted);" />
											{:else}
												<Trash2 class="w-3.5 h-3.5 text-red-400" />
											{/if}
										</button>
									</div>
								{/each}
							</div>
						</div>
					{:else if koreaderSettings.progressEntries > 0}
						<p class="text-sm" style="color: var(--text-muted);">
							{koreaderSettings.progressEntries} reading progress {koreaderSettings.progressEntries === 1 ? 'entry' : 'entries'} synced
						</p>
					{:else}
						<p class="text-sm" style="color: var(--text-muted);">
							No sync activity yet. Start reading on your e-reader to see progress here.
						</p>
					{/if}

					<!-- Actions -->
					<div class="flex items-center gap-3 pt-2">
						<button
							type="button"
							class="btn-ghost text-sm flex items-center gap-2"
							onclick={() => { koreaderSettings = null; koreaderLoading = false; }}
						>
							<Edit class="w-4 h-4" />
							Edit Credentials
						</button>
						<button
							type="button"
							class="text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-red-500/10"
							style="color: #ef4444;"
							onclick={deleteKoreaderCredentials}
						>
							<Trash2 class="w-4 h-4" />
							Remove
						</button>
					</div>
				</div>
			{:else}
				<!-- Not configured - show setup form -->
				<div class="space-y-4">
					<div class="p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
						<p class="text-sm mb-4" style="color: var(--text-secondary);">
							Create credentials to use with KOReader's sync feature. These are separate from your BookShelf login.
						</p>

						<div class="space-y-3">
							<div>
								<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
									Username
								</label>
								<input
									type="text"
									class="input w-full"
									placeholder="e.g., koreader_user"
									bind:value={koreaderUsername}
									minlength="3"
								/>
							</div>

							<div>
								<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
									Password
								</label>
								<input
									type="password"
									class="input w-full"
									placeholder="At least 6 characters"
									bind:value={koreaderPassword}
									minlength="6"
								/>
							</div>

							<button
								type="button"
								class="btn-primary w-full flex items-center justify-center gap-2"
								onclick={saveKoreaderCredentials}
								disabled={koreaderSaving}
							>
								{#if koreaderSaving}
									<Loader2 class="w-4 h-4 animate-spin" />
									Saving...
								{:else}
									<Save class="w-4 h-4" />
									Save Credentials
								{/if}
							</button>
						</div>
					</div>

					<div class="text-sm" style="color: var(--text-muted);">
						<p class="font-medium mb-2">How to set up KOReader:</p>
						<ol class="list-decimal list-inside space-y-1">
							<li>Create credentials above</li>
							<li>On your e-reader, go to KOReader Settings → Cloud Storage → Progress Sync</li>
							<li>Enter the sync server URL and your credentials</li>
							<li>Enable sync and your reading progress will sync automatically</li>
						</ol>
					</div>
				</div>
			{/if}
		</section>

		<!-- Kobo Sync Section -->
		<section class="card p-6">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<Smartphone class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Kobo Sync</h2>
				</div>
				{#if koboSettings?.configured}
					<button
						type="button"
						class="text-sm px-3 py-1.5 rounded-lg transition-colors"
						style="background-color: {koboSettings.syncEnabled ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {koboSettings.syncEnabled ? 'white' : 'var(--text-muted)'};"
						onclick={toggleKoboSync}
					>
						{koboSettings.syncEnabled ? 'Sync Enabled' : 'Sync Disabled'}
					</button>
				{/if}
			</div>

			<p class="text-sm mb-4" style="color: var(--text-muted);">
				Sync your BookShelf library directly to your Kobo e-reader. Books tagged with "kobo" will appear on your device.
			</p>

			<!-- How it works info -->
			<div class="p-3 rounded-lg mb-4 flex gap-3" style="background-color: var(--bg-tertiary); border-left: 3px solid var(--accent);">
				<Info class="w-4 h-4 flex-shrink-0 mt-0.5" style="color: var(--accent);" />
				<div class="text-xs space-y-1" style="color: var(--text-muted);">
					<p><strong style="color: var(--text-secondary);">How it works:</strong> BookShelf acts as a Kobo sync server. Your Kobo device connects to BookShelf instead of Kobo's servers.</p>
					<p><strong style="color: var(--text-secondary);">Tag-based sync:</strong> Add the "kobo" tag to any book you want on your device. Remove the tag to remove from device.</p>
					<p><strong style="color: var(--text-secondary);">Kobo Store:</strong> You can still access purchased Kobo books - those requests are proxied to Kobo's servers.</p>
				</div>
			</div>

			{#if koboLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="w-6 h-6 animate-spin" style="color: var(--text-muted);" />
				</div>
			{:else if koboSettings?.configured}
				<!-- Configured - show sync URL and settings -->
				<div class="space-y-4">
					<!-- Sync URL -->
					<div class="p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
						<div class="flex items-center justify-between mb-2">
							<span class="text-sm font-medium" style="color: var(--text-secondary);">Kobo Sync URL</span>
							<button
								type="button"
								class="p-1.5 rounded transition-colors hover:bg-black/10"
								onclick={() => copyToClipboard(`${window.location.origin}/api/kobo/${koboSettings?.token}`, 'URL')}
								title="Copy URL"
							>
								<Copy class="w-4 h-4" style="color: var(--text-muted);" />
							</button>
						</div>
						<code class="text-sm break-all" style="color: var(--text-primary);">
							{typeof window !== 'undefined' ? `${window.location.origin}/api/kobo/${showKoboToken ? koboSettings.token : '••••••••'}` : `/api/kobo/${showKoboToken ? koboSettings?.token : '••••••••'}`}
						</code>
						<div class="flex items-center gap-2 mt-2">
							<button
								type="button"
								class="text-xs px-2 py-1 rounded transition-colors flex items-center gap-1"
								style="background-color: var(--bg-secondary); color: var(--text-muted);"
								onclick={() => showKoboToken = !showKoboToken}
							>
								<Eye class="w-3 h-3" />
								{showKoboToken ? 'Hide' : 'Show'} token
							</button>
						</div>
					</div>

					<!-- Connected Devices -->
					{#if koboSettings.devices && koboSettings.devices.length > 0}
						<div>
							<div class="flex items-center gap-2 mb-3">
								<Tablet class="w-4 h-4" style="color: var(--text-muted);" />
								<span class="text-sm font-medium" style="color: var(--text-secondary);">Connected Devices</span>
							</div>
							<div class="space-y-2">
								{#each koboSettings.devices as device}
									<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
										<div class="flex items-center gap-3">
											<Smartphone class="w-5 h-5" style="color: var(--accent);" />
											<div>
												<p class="font-medium text-sm" style="color: var(--text-primary);">
													{device.deviceModel || 'Kobo Device'}
												</p>
												<p class="text-xs" style="color: var(--text-muted);">
													{device.deviceId.substring(0, 16)}...
												</p>
											</div>
										</div>
										{#if device.lastSyncAt}
											<span class="text-xs" style="color: var(--text-muted);">
												Last sync: {formatRelativeTime(device.lastSyncAt, null)}
											</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Setup Instructions -->
					<div class="p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
						<p class="font-medium mb-3" style="color: var(--text-secondary);">Setup Instructions</p>

						<div class="space-y-4 text-sm" style="color: var(--text-muted);">
							<!-- Step 1 -->
							<div class="flex gap-3">
								<span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style="background-color: var(--accent); color: white;">1</span>
								<div>
									<p class="font-medium" style="color: var(--text-primary);">Connect Kobo to Computer</p>
									<p>Connect your Kobo e-reader via USB cable. It should appear as a drive on your computer.</p>
								</div>
							</div>

							<!-- Step 2 -->
							<div class="flex gap-3">
								<span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style="background-color: var(--accent); color: white;">2</span>
								<div>
									<p class="font-medium" style="color: var(--text-primary);">Enable Hidden Files</p>
									<p>Show hidden files on your computer:</p>
									<ul class="list-disc list-inside ml-2 mt-1 space-y-0.5">
										<li><strong>Windows:</strong> File Explorer → View → Show hidden files</li>
										<li><strong>macOS:</strong> Press <code class="px-1 py-0.5 rounded text-xs" style="background-color: var(--bg-secondary);">Cmd + Shift + .</code></li>
										<li><strong>Linux:</strong> Press <code class="px-1 py-0.5 rounded text-xs" style="background-color: var(--bg-secondary);">Ctrl + H</code> in file manager</li>
									</ul>
								</div>
							</div>

							<!-- Step 3 -->
							<div class="flex gap-3">
								<span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style="background-color: var(--accent); color: white;">3</span>
								<div>
									<p class="font-medium" style="color: var(--text-primary);">Edit Configuration File</p>
									<p>Navigate to the Kobo drive and open:</p>
									<code class="block mt-1 p-2 rounded text-xs break-all" style="background-color: var(--bg-secondary);">.kobo/Kobo/Kobo eReader.conf</code>
									<p class="mt-1">Open this file with a text editor (Notepad, TextEdit, etc.)</p>
								</div>
							</div>

							<!-- Step 4 -->
							<div class="flex gap-3">
								<span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style="background-color: var(--accent); color: white;">4</span>
								<div>
									<p class="font-medium" style="color: var(--text-primary);">Add BookShelf Endpoint</p>
									<p>Find or add the <code class="px-1 py-0.5 rounded text-xs" style="background-color: var(--bg-secondary);">[OneStoreServices]</code> section, then add:</p>
									<code class="block mt-1 p-2 rounded text-xs break-all" style="background-color: var(--bg-secondary);">api_endpoint={typeof window !== 'undefined' ? `${window.location.origin}/api/kobo/${koboSettings?.token}` : 'YOUR_SYNC_URL'}</code>
									<p class="mt-1 text-xs" style="color: var(--text-muted);">If the section doesn't exist, add it at the end of the file.</p>
								</div>
							</div>

							<!-- Step 5 -->
							<div class="flex gap-3">
								<span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style="background-color: var(--accent); color: white;">5</span>
								<div>
									<p class="font-medium" style="color: var(--text-primary);">Save and Restart</p>
									<p>Save the file, safely eject your Kobo, and restart the device. Your library will sync on next WiFi connection.</p>
								</div>
							</div>
						</div>

						<!-- Example config -->
						<details class="mt-4">
							<summary class="cursor-pointer text-sm font-medium" style="color: var(--accent);">View example configuration</summary>
							<pre class="mt-2 p-3 rounded text-xs overflow-x-auto" style="background-color: var(--bg-secondary); color: var(--text-primary);">[OneStoreServices]
api_endpoint={typeof window !== 'undefined' ? `${window.location.origin}/api/kobo/${koboSettings?.token}` : 'https://your-bookshelf-url/api/kobo/YOUR_TOKEN'}</pre>
						</details>
					</div>

					<!-- Tag reminder -->
					<div class="flex items-start gap-3 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
						<Tag class="w-4 h-4 flex-shrink-0 mt-0.5" style="color: var(--accent);" />
						<div class="text-sm">
							<p class="font-medium" style="color: var(--text-secondary);">Tag your books to sync</p>
							<p style="color: var(--text-muted);">Add the <strong>"kobo"</strong> tag to any book you want on your device. Remove the tag to remove it from your Kobo.</p>
						</div>
					</div>

					<!-- Troubleshooting -->
					<details class="text-sm">
						<summary class="cursor-pointer font-medium py-2" style="color: var(--text-secondary);">Troubleshooting</summary>
						<div class="mt-2 space-y-2 pl-4" style="color: var(--text-muted);">
							<p><strong>Books not appearing?</strong> Make sure the book has the "kobo" tag and has an ebook file (EPUB) attached.</p>
							<p><strong>Sync not working?</strong> Ensure your Kobo is connected to WiFi and BookShelf is accessible from your network.</p>
							<p><strong>HTTPS required?</strong> If your BookShelf uses HTTPS, make sure your Kobo's clock is set correctly (Settings → Date & Time).</p>
							<p><strong>Want to revert?</strong> Remove the <code class="px-1 py-0.5 rounded text-xs" style="background-color: var(--bg-secondary);">api_endpoint</code> line from the config file to use Kobo's default servers again.</p>
						</div>
					</details>

					<!-- Actions -->
					<div class="flex items-center gap-3 pt-2">
						<button
							type="button"
							class="btn-ghost text-sm flex items-center gap-2"
							onclick={regenerateKoboToken}
						>
							<RefreshCw class="w-4 h-4" />
							Regenerate Token
						</button>
						<button
							type="button"
							class="text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-red-500/10"
							style="color: #ef4444;"
							onclick={deleteKoboSettings}
						>
							<Power class="w-4 h-4" />
							Disable Sync
						</button>
					</div>
				</div>
			{:else}
				<!-- Not configured - show enable button -->
				<div class="text-center py-6">
					<Smartphone class="w-12 h-12 mx-auto mb-3 opacity-30" style="color: var(--text-muted);" />
					<p class="font-medium mb-2" style="color: var(--text-primary);">Kobo sync not configured</p>
					<p class="text-sm mb-4" style="color: var(--text-muted);">
						Enable Kobo sync to sync your BookShelf library to your Kobo e-reader.
					</p>
					<button
						type="button"
						class="btn-primary flex items-center gap-2 mx-auto"
						onclick={enableKoboSync}
						disabled={koboSaving}
					>
						{#if koboSaving}
							<Loader2 class="w-4 h-4 animate-spin" />
							Enabling...
						{:else}
							<Power class="w-4 h-4" />
							Enable Kobo Sync
						{/if}
					</button>
				</div>
			{/if}
		</section>

		<!-- Library Sharing Section -->
		<section class="card p-6">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<Users class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Library Sharing</h2>
				</div>
				{#if data.librarySharing?.shareableUsers?.length > 0}
					<button
						type="button"
						class="btn-primary flex items-center gap-2 text-sm"
						onclick={() => showShareModal = true}
					>
						<UserPlus class="w-4 h-4" />
						Share Library
					</button>
				{/if}
			</div>

			<p class="text-sm mb-4" style="color: var(--text-muted);">
				Share your book library with family members or housemates. They'll be able to see your books based on the permission level you set.
			</p>

			<!-- My Shares (Who I'm sharing with) -->
			{#if data.librarySharing?.myShares?.length > 0}
				<div class="mb-6">
					<h3 class="text-sm font-medium mb-3" style="color: var(--text-secondary);">
						People with access to your library
					</h3>
					<div class="space-y-2">
						{#each data.librarySharing.myShares as share}
							<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
								<div class="flex items-center gap-3">
									<div
										class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
										style="background: var(--accent);"
									>
										{(share.sharedWithName || share.sharedWithEmail || '?').charAt(0).toUpperCase()}
									</div>
									<div>
										<p class="font-medium" style="color: var(--text-primary);">
											{share.sharedWithName || share.sharedWithEmail}
										</p>
										{#if share.sharedWithName && share.sharedWithEmail}
											<p class="text-xs" style="color: var(--text-muted);">{share.sharedWithEmail}</p>
										{/if}
									</div>
								</div>
								<div class="flex items-center gap-3">
									<select
										class="form-input text-sm"
										value={share.permission}
										onchange={(e) => updateSharePermission(share.sharedWithId, (e.target as HTMLSelectElement).value)}
									>
										<option value="read">View Only</option>
										<option value="read_write">Can Edit</option>
										<option value="full">Full Access</option>
									</select>
									<button
										type="button"
										class="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
										title="Remove access"
										onclick={() => removeLibraryShare(share.sharedWithId)}
										disabled={removingShareId === share.sharedWithId}
									>
										{#if removingShareId === share.sharedWithId}
											<Loader2 class="w-4 h-4 animate-spin" style="color: var(--text-muted);" />
										{:else}
											<Trash2 class="w-4 h-4 text-red-400" />
										{/if}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Libraries Shared With Me -->
			{#if data.librarySharing?.sharedWithMe?.length > 0}
				<div>
					<h3 class="text-sm font-medium mb-3" style="color: var(--text-secondary);">
						Libraries shared with you
					</h3>
					<div class="space-y-2">
						{#each data.librarySharing.sharedWithMe as share}
							{@const perm = permissionLabels[share.permission] || permissionLabels.read}
							{@const PermIcon = perm.icon}
							<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
								<div class="flex items-center gap-3">
									<div
										class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
										style="background: #6366f1;"
									>
										{(share.ownerName || share.ownerEmail || '?').charAt(0).toUpperCase()}
									</div>
									<div>
										<p class="font-medium" style="color: var(--text-primary);">
											{share.ownerName || share.ownerEmail}'s Library
										</p>
										{#if share.ownerName && share.ownerEmail}
											<p class="text-xs" style="color: var(--text-muted);">{share.ownerEmail}</p>
										{/if}
									</div>
								</div>
								<div class="flex items-center gap-2">
									<span class="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style="background: var(--bg-secondary); color: var(--text-secondary);">
										<PermIcon class="w-3 h-3" />
										{perm.label}
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Empty State -->
			{#if (!data.librarySharing?.myShares || data.librarySharing.myShares.length === 0) && (!data.librarySharing?.sharedWithMe || data.librarySharing.sharedWithMe.length === 0)}
				<div class="text-center py-8" style="color: var(--text-muted);">
					<Users class="w-12 h-12 mx-auto mb-3 opacity-30" />
					<p class="font-medium">No shared libraries</p>
					<p class="text-sm mt-1">Share your library with family or friends to get started</p>
				</div>
			{/if}
		</section>
	</div>
</div>

<!-- Share Library Modal -->
{#if showShareModal}
	<div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md" style="background-color: var(--bg-secondary);">
			<div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--border-color);">
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Share Your Library</h2>
				<button
					type="button"
					class="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={() => showShareModal = false}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="p-6 space-y-4">
				<!-- User Selection -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Share with
					</label>
					<select class="form-input w-full" bind:value={selectedUserId}>
						<option value={null}>Select a user...</option>
						{#each data.librarySharing?.shareableUsers || [] as user}
							<option value={user.id}>{user.username} ({user.email})</option>
						{/each}
					</select>
				</div>

				<!-- Permission Level -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Permission Level
					</label>
					<div class="space-y-2">
						{#each Object.entries(permissionLabels) as [value, { label, description, icon: PermIcon }]}
							<label
								class="flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all"
								style="background-color: {selectedPermission === value ? 'var(--accent)' : 'var(--bg-tertiary)'};
								       border-color: {selectedPermission === value ? 'var(--accent)' : 'var(--border-color)'};
								       color: {selectedPermission === value ? 'white' : 'var(--text-primary)'};"
							>
								<input
									type="radio"
									name="permission"
									{value}
									bind:group={selectedPermission}
									class="sr-only"
								/>
								<PermIcon class="w-5 h-5" />
								<div>
									<p class="font-medium">{label}</p>
									<p class="text-xs opacity-75">{description}</p>
								</div>
							</label>
						{/each}
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-3 px-6 py-4 border-t" style="border-color: var(--border-color);">
				<button
					type="button"
					class="btn-ghost"
					onclick={() => showShareModal = false}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn-primary flex items-center gap-2"
					onclick={shareLibrary}
					disabled={sharingInProgress || !selectedUserId}
				>
					{#if sharingInProgress}
						<Loader2 class="w-4 h-4 animate-spin" />
					{:else}
						<UserPlus class="w-4 h-4" />
					{/if}
					Share Library
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Link to Book Modal -->
{#if showLinkModal}
	<div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
		<div class="rounded-xl shadow-2xl w-full max-w-md" style="background-color: var(--bg-secondary);">
			<div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--border-color);">
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Link to Book</h2>
				<button
					type="button"
					class="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={() => { showLinkModal = false; linkingProgressId = null; }}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--text-muted);">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="p-6 space-y-4">
				<p class="text-sm" style="color: var(--text-muted);">
					Search for a book in your library to link this reading progress to.
				</p>

				<!-- Search Input -->
				<div class="flex gap-2">
					<input
						type="text"
						class="form-input flex-1"
						placeholder="Search by title or author..."
						bind:value={linkSearchQuery}
						onkeydown={(e) => e.key === 'Enter' && searchBooksForLink()}
					/>
					<button
						type="button"
						class="btn-primary px-4"
						onclick={searchBooksForLink}
						disabled={linkSearching}
					>
						{#if linkSearching}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							Search
						{/if}
					</button>
				</div>

				<!-- Search Results -->
				{#if linkSearchResults.length > 0}
					<div class="max-h-60 overflow-y-auto space-y-2">
						{#each linkSearchResults as book}
							<button
								type="button"
								class="w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700"
								style="background-color: var(--bg-tertiary);"
								onclick={() => linkProgressToBook(book.id)}
							>
								<BookIcon class="w-5 h-5 flex-shrink-0" style="color: var(--accent);" />
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate" style="color: var(--text-primary);">{book.title}</div>
									{#if book.author}
										<div class="text-xs truncate" style="color: var(--text-muted);">{book.author}</div>
									{/if}
								</div>
								<Link class="w-4 h-4 flex-shrink-0" style="color: var(--text-muted);" />
							</button>
						{/each}
					</div>
				{:else if linkSearchQuery && !linkSearching}
					<p class="text-sm text-center py-4" style="color: var(--text-muted);">
						No books found. Try a different search term.
					</p>
				{/if}
			</div>

			<div class="flex justify-end px-6 py-4 border-t" style="border-color: var(--border-color);">
				<button
					type="button"
					class="btn-ghost"
					onclick={() => { showLinkModal = false; linkingProgressId = null; }}
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.form-input {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background-color: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.toggle {
		width: 2.5rem;
		height: 1.25rem;
		appearance: none;
		background-color: var(--border-color);
		border-radius: 9999px;
		cursor: pointer;
		position: relative;
		transition: background-color 0.2s;
	}

	.toggle::before {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 1rem;
		height: 1rem;
		background-color: white;
		border-radius: 50%;
		transition: transform 0.2s;
	}

	.toggle:checked {
		background-color: var(--accent);
	}

	.toggle:checked::before {
		transform: translateX(1.25rem);
	}

	input[type="range"] {
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 3px;
		background: var(--border-color);
	}

	input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent);
		cursor: pointer;
	}

	input[type="color"] {
		-webkit-appearance: none;
		appearance: none;
		border: none;
		padding: 0;
	}

	input[type="color"]::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	input[type="color"]::-webkit-color-swatch {
		border: 2px solid var(--border-color);
		border-radius: 0.5rem;
	}
</style>
