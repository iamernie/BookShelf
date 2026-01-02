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
		AlertCircle
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
