<script lang="ts">
	import {
		Settings, FolderOpen, BookOpen, Monitor, Rss, Upload, Save, Check,
		AlertCircle, Loader2, Database, Sparkles, Eye, EyeOff, FileText,
		HelpCircle, UserPlus, KeyRound, Users, Shield, Mail, Send, Bell
	} from 'lucide-svelte';

	interface Placeholder {
		placeholder: string;
		description: string;
		example: string;
	}

	interface SettingOption {
		value: string;
		label: string;
	}

	interface Setting {
		key: string;
		value: string;
		type: string;
		category: string;
		label: string;
		description: string;
		options?: SettingOption[];
	}

	let { data } = $props();

	// Tab state
	type TabId = 'general' | 'storage' | 'metadata' | 'opds' | 'import' | 'registration' | 'email' | 'oidc' | 'ai' | 'ui' | 'notifications';
	let activeTab = $state<TabId>('general');

	// Tab definitions
	const tabs: { id: TabId; label: string; icon: typeof Settings; description: string }[] = [
		{ id: 'general', label: 'General', icon: Settings, description: 'Library and display settings' },
		{ id: 'storage', label: 'Storage', icon: FolderOpen, description: 'File storage configuration' },
		{ id: 'metadata', label: 'Metadata', icon: Database, description: 'Book metadata providers' },
		{ id: 'opds', label: 'OPDS', icon: Rss, description: 'OPDS catalog settings' },
		{ id: 'import', label: 'Import', icon: Upload, description: 'Import behavior' },
		{ id: 'registration', label: 'Users', icon: UserPlus, description: 'User registration' },
		{ id: 'email', label: 'Email', icon: Mail, description: 'SMTP email settings' },
		{ id: 'oidc', label: 'SSO', icon: KeyRound, description: 'OIDC/SSO providers' },
		{ id: 'ai', label: 'AI', icon: Sparkles, description: 'AI recommendations' },
		{ id: 'notifications', label: 'Notifications', icon: Bell, description: 'ntfy push notifications' },
		{ id: 'ui', label: 'UI', icon: Monitor, description: 'User interface settings' }
	];

	// Local copy of settings for editing
	let editedSettings = $state<Record<string, string>>({});
	let isSaving = $state(false);
	let saveSuccess = $state(false);
	let saveError = $state('');

	// AI settings state
	let aiEnabled = $state(data.aiSettings.enabled);
	let aiApiKey = $state(data.aiSettings.apiKey || '');
	let aiModel = $state(data.aiSettings.model);
	let showApiKey = $state(false);
	let testingConnection = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);
	let savingAI = $state(false);
	let aiSaveSuccess = $state(false);

	// Pattern preview state
	let placeholders = $state<Placeholder[]>([]);
	let ebookPatternPreview = $state('');
	let coverPatternPreview = $state('');
	let audiobookPatternPreview = $state('');
	let showPatternHelp = $state(false);

	// Email test state
	let testEmailAddress = $state('');
	let testingEmail = $state(false);
	let emailTestResult = $state<{ success: boolean; message: string } | null>(null);
	let showSmtpPassword = $state(false);

	// Map categories to tabs
	const categoryToTab: Record<string, TabId> = {
		library: 'general',
		display: 'general',
		storage: 'storage',
		metadata: 'metadata',
		opds: 'opds',
		import: 'import',
		registration: 'registration',
		email: 'email',
		notifications: 'notifications',
		ui: 'ui'
	};

	// ntfy test state
	let testingNtfy = $state(false);
	let ntfyTestResult = $state<{ success: boolean; message: string } | null>(null);

	// Fetch placeholders on mount
	$effect(() => {
		fetch('/api/settings/patterns')
			.then(res => res.json())
			.then(data => {
				placeholders = data.placeholders || [];
			})
			.catch(console.error);
	});

	// Update pattern previews when patterns change
	async function updatePatternPreview(pattern: string, type: 'ebook' | 'cover' | 'audiobook') {
		try {
			const res = await fetch('/api/settings/patterns', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern })
			});
			const data = await res.json();
			if (type === 'ebook') {
				ebookPatternPreview = data.preview || '';
			} else if (type === 'cover') {
				coverPatternPreview = data.preview || '';
			} else {
				audiobookPatternPreview = data.preview || '';
			}
		} catch (err) {
			console.error('Failed to preview pattern:', err);
		}
	}

	// Initialize pattern previews
	$effect(() => {
		const ebookPattern = editedSettings['storage.ebook_path_pattern'];
		const coverPattern = editedSettings['storage.cover_path_pattern'];
		const audiobookPattern = editedSettings['storage.audiobook_path_pattern'];
		if (ebookPattern) updatePatternPreview(ebookPattern, 'ebook');
		if (coverPattern) updatePatternPreview(coverPattern, 'cover');
		if (audiobookPattern) updatePatternPreview(audiobookPattern, 'audiobook');
	});

	// Initialize edited settings from data
	$effect(() => {
		const initial: Record<string, string> = {};
		for (const category of Object.values(data.settings)) {
			for (const setting of category as Setting[]) {
				initial[setting.key] = setting.value;
			}
		}
		editedSettings = initial;
	});

	// Category display info
	const categoryInfo: Record<string, { icon: typeof Settings; title: string; description: string }> = {
		storage: {
			icon: FolderOpen,
			title: 'Storage',
			description: 'Configure where files are stored on the server'
		},
		library: {
			icon: BookOpen,
			title: 'Library',
			description: 'General library settings'
		},
		display: {
			icon: Monitor,
			title: 'Display',
			description: 'Customize how books are displayed'
		},
		opds: {
			icon: Rss,
			title: 'OPDS Catalog',
			description: 'Settings for the OPDS ebook catalog'
		},
		import: {
			icon: Upload,
			title: 'Import',
			description: 'Configure import behavior'
		},
		metadata: {
			icon: Database,
			title: 'Metadata Providers',
			description: 'Configure book metadata lookup sources'
		},
		registration: {
			icon: UserPlus,
			title: 'User Registration',
			description: 'Configure public signup and email verification'
		},
		email: {
			icon: Mail,
			title: 'Email / SMTP',
			description: 'Configure SMTP settings for email notifications'
		},
		ui: {
			icon: Monitor,
			title: 'User Interface',
			description: 'Configure UI behavior and notifications'
		}
	};

	// Get settings for a specific tab
	function getSettingsForTab(tabId: TabId): [string, Setting[]][] {
		const result: [string, Setting[]][] = [];
		for (const [category, settings] of Object.entries(data.settings)) {
			if (categoryToTab[category] === tabId) {
				result.push([category, settings as Setting[]]);
			}
		}
		return result;
	}

	function updateSetting(key: string, value: string) {
		editedSettings = { ...editedSettings, [key]: value };
	}

	async function saveSettings() {
		isSaving = true;
		saveSuccess = false;
		saveError = '';

		try {
			const response = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editedSettings)
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Failed to save settings');
			}

			saveSuccess = true;
			setTimeout(() => saveSuccess = false, 3000);
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to save settings';
		} finally {
			isSaving = false;
		}
	}

	function renderInput(setting: Setting) {
		const value = editedSettings[setting.key] ?? setting.value;

		if (setting.type === 'boolean') {
			return {
				type: 'checkbox',
				checked: value === 'true' || value === '1'
			};
		}

		if (setting.type === 'number') {
			return {
				type: 'number',
				value
			};
		}

		return {
			type: 'text',
			value
		};
	}

	async function testAIConnection() {
		if (!aiApiKey.trim()) {
			testResult = { success: false, message: 'Please enter an API key' };
			return;
		}

		testingConnection = true;
		testResult = null;

		try {
			const res = await fetch('/api/recommendations/ai/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey: aiApiKey })
			});

			const result = await res.json();
			testResult = {
				success: result.success,
				message: result.success ? 'Connection successful!' : result.error || 'Connection failed'
			};
		} catch {
			testResult = { success: false, message: 'Failed to test connection' };
		} finally {
			testingConnection = false;
		}
	}

	async function saveAISettings() {
		savingAI = true;
		aiSaveSuccess = false;

		try {
			const res = await fetch('/api/recommendations/ai/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: aiEnabled,
					apiKey: aiApiKey,
					model: aiModel
				})
			});

			if (!res.ok) {
				throw new Error('Failed to save');
			}

			aiSaveSuccess = true;
			setTimeout(() => aiSaveSuccess = false, 3000);
		} catch {
			saveError = 'Failed to save AI settings';
		} finally {
			savingAI = false;
		}
	}

	async function sendTestEmail() {
		if (!testEmailAddress.trim()) {
			emailTestResult = { success: false, message: 'Please enter an email address' };
			return;
		}

		testingEmail = true;
		emailTestResult = null;

		try {
			const res = await fetch('/api/settings/email/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: testEmailAddress })
			});

			const result = await res.json();
			emailTestResult = {
				success: result.success,
				message: result.success ? 'Test email sent successfully!' : result.error || 'Failed to send test email'
			};
		} catch {
			emailTestResult = { success: false, message: 'Failed to send test email' };
		} finally {
			testingEmail = false;
		}
	}

	async function sendTestNtfyNotification() {
		testingNtfy = true;
		ntfyTestResult = null;

		try {
			const res = await fetch('/api/notifications/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'admin' })
			});

			const result = await res.json();
			ntfyTestResult = {
				success: result.success,
				message: result.success ? 'Test notification sent!' : result.error || 'Failed to send notification'
			};
		} catch {
			ntfyTestResult = { success: false, message: 'Failed to send test notification' };
		} finally {
			testingNtfy = false;
		}
	}
</script>

<svelte:head>
	<title>System Settings - Admin - BookShelf</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">System Settings</h1>
			<p class="text-sm mt-1" style="color: var(--text-secondary);">Configure application-wide settings</p>
		</div>

		{#if data.isAdmin && activeTab !== 'oidc'}
			<button
				class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
				style="background: var(--accent); color: white;"
				onclick={activeTab === 'ai' ? saveAISettings : saveSettings}
				disabled={isSaving || savingAI}
			>
				{#if isSaving || savingAI}
					<Loader2 class="w-4 h-4 animate-spin" />
					Saving...
				{:else if saveSuccess || aiSaveSuccess}
					<Check class="w-4 h-4" />
					Saved!
				{:else}
					<Save class="w-4 h-4" />
					Save Changes
				{/if}
			</button>
		{/if}
	</div>

	{#if saveError}
		<div class="mb-4 p-3 rounded-lg flex items-center gap-2" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
			<AlertCircle class="w-5 h-5" />
			{saveError}
		</div>
	{/if}

	{#if !data.isAdmin}
		<div class="mb-4 p-3 rounded-lg" style="background: rgba(234, 179, 8, 0.1); color: #eab308;">
			<div class="flex items-center gap-2">
				<AlertCircle class="w-5 h-5" />
				<span class="font-medium">View Only</span>
			</div>
			<p class="mt-1 text-sm">You need admin access to modify settings.</p>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto" style="background: var(--bg-secondary);">
		{#each tabs as tab}
			<button
				class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
				class:active-tab={activeTab === tab.id}
				style="color: {activeTab === tab.id ? 'white' : 'var(--text-secondary)'}; background: {activeTab === tab.id ? 'var(--accent)' : 'transparent'};"
				onclick={() => activeTab = tab.id}
			>
				<svelte:component this={tab.icon} class="w-4 h-4" />
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="space-y-6">
		{#if activeTab === 'oidc'}
			<!-- OIDC Tab - Link to dedicated page -->
			<div class="rounded-xl p-8 text-center" style="background: var(--bg-secondary);">
				<div class="w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-4" style="background: var(--bg-tertiary);">
					<KeyRound class="w-8 h-8" style="color: var(--accent);" />
				</div>
				<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">Single Sign-On (SSO)</h2>
				<p class="mb-6" style="color: var(--text-muted);">
					Configure OIDC providers like Google, GitHub, Authentik, or Keycloak for SSO authentication.
				</p>
				<a
					href="/admin/settings/oidc"
					class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors"
					style="background: var(--accent); color: white;"
				>
					<Shield class="w-5 h-5" />
					Manage SSO Providers
				</a>
			</div>

		{:else if activeTab === 'email'}
			<!-- Email/SMTP Settings Tab -->
			<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary);">
				<div class="p-4 border-b flex items-center justify-between" style="border-color: var(--border-color);">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: var(--bg-tertiary);">
							<Mail class="w-5 h-5" style="color: var(--accent);" />
						</div>
						<div>
							<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Email / SMTP</h2>
							<p class="text-sm" style="color: var(--text-muted);">Configure email delivery for notifications</p>
						</div>
					</div>
					{#if data.emailStatus.configured}
						<span class="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;">
							<Check class="w-4 h-4" />
							{data.emailStatus.configuredViaEnv ? 'Configured via Environment' : 'Configured'}
						</span>
					{:else}
						<span class="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium" style="background: rgba(234, 179, 8, 0.1); color: #eab308;">
							<AlertCircle class="w-4 h-4" />
							Not Configured
						</span>
					{/if}
				</div>

				{#if data.emailStatus.configuredViaEnv}
					<!-- Environment variable override notice -->
					<div class="p-4 flex items-start gap-3" style="background: rgba(59, 130, 246, 0.05);">
						<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: #3b82f6;" />
						<div>
							<p class="font-medium" style="color: var(--text-primary);">Configured via Environment Variables</p>
							<p class="text-sm mt-1" style="color: var(--text-muted);">
								SMTP settings are currently configured through environment variables. The settings below are read-only.
								To use database settings instead, remove the SMTP_HOST environment variable.
							</p>
							<div class="mt-3 grid grid-cols-2 gap-2 text-sm">
								<div><span style="color: var(--text-muted);">Host:</span> <code class="px-1.5 py-0.5 rounded" style="background: var(--bg-tertiary);">{data.emailStatus.host}</code></div>
								<div><span style="color: var(--text-muted);">Port:</span> <code class="px-1.5 py-0.5 rounded" style="background: var(--bg-tertiary);">{data.emailStatus.port}</code></div>
								<div class="col-span-2"><span style="color: var(--text-muted);">From:</span> <code class="px-1.5 py-0.5 rounded" style="background: var(--bg-tertiary);">{data.emailStatus.from}</code></div>
							</div>
						</div>
					</div>
				{/if}

				<div class="divide-y" style="border-color: var(--border-color);">
					<!-- SMTP Host -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="email.smtp_host" class="font-medium" style="color: var(--text-primary);">SMTP Host</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">SMTP server hostname (e.g., smtp.gmail.com)</p>
						</div>
						<div class="w-72">
							<input
								type="text"
								id="email.smtp_host"
								value={editedSettings['email.smtp_host'] ?? ''}
								oninput={(e) => updateSetting('email.smtp_host', (e.target as HTMLInputElement).value)}
								disabled={!data.isAdmin || data.emailStatus.configuredViaEnv}
								placeholder="smtp.example.com"
								class="w-full px-3 py-2 rounded-lg text-sm"
								style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); {data.emailStatus.configuredViaEnv ? 'opacity: 0.5;' : ''}"
							/>
						</div>
					</div>

					<!-- SMTP Port -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="email.smtp_port" class="font-medium" style="color: var(--text-primary);">SMTP Port</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">587 for TLS, 465 for SSL, 25 for plain</p>
						</div>
						<div class="w-72">
							<input
								type="number"
								id="email.smtp_port"
								value={editedSettings['email.smtp_port'] ?? '587'}
								oninput={(e) => updateSetting('email.smtp_port', (e.target as HTMLInputElement).value)}
								disabled={!data.isAdmin || data.emailStatus.configuredViaEnv}
								class="w-full px-3 py-2 rounded-lg text-sm"
								style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); {data.emailStatus.configuredViaEnv ? 'opacity: 0.5;' : ''}"
							/>
						</div>
					</div>

					<!-- Use SSL/TLS -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label class="font-medium" style="color: var(--text-primary);">Use SSL/TLS</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">Enable for implicit TLS (port 465). Leave off for STARTTLS (port 587)</p>
						</div>
						<div class="w-72">
							<button
								type="button"
								class="toggle-switch {editedSettings['email.smtp_secure'] === 'true' ? 'active' : ''}"
								onclick={() => updateSetting('email.smtp_secure', editedSettings['email.smtp_secure'] === 'true' ? 'false' : 'true')}
								disabled={!data.isAdmin || data.emailStatus.configuredViaEnv}
								role="switch"
								aria-checked={editedSettings['email.smtp_secure'] === 'true'}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>
					</div>

					<!-- SMTP Username -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="email.smtp_user" class="font-medium" style="color: var(--text-primary);">SMTP Username</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">Username for authentication (often your email address)</p>
						</div>
						<div class="w-72">
							<input
								type="text"
								id="email.smtp_user"
								value={editedSettings['email.smtp_user'] ?? ''}
								oninput={(e) => updateSetting('email.smtp_user', (e.target as HTMLInputElement).value)}
								disabled={!data.isAdmin || data.emailStatus.configuredViaEnv}
								placeholder="user@example.com"
								class="w-full px-3 py-2 rounded-lg text-sm"
								style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); {data.emailStatus.configuredViaEnv ? 'opacity: 0.5;' : ''}"
							/>
						</div>
					</div>

					<!-- SMTP Password -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="email.smtp_pass" class="font-medium" style="color: var(--text-primary);">SMTP Password</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">Password or app-specific password</p>
						</div>
						<div class="w-72">
							<div class="relative">
								<input
									type={showSmtpPassword ? 'text' : 'password'}
									id="email.smtp_pass"
									value={editedSettings['email.smtp_pass'] ?? ''}
									oninput={(e) => updateSetting('email.smtp_pass', (e.target as HTMLInputElement).value)}
									disabled={!data.isAdmin || data.emailStatus.configuredViaEnv}
									placeholder="••••••••"
									class="w-full px-3 py-2 pr-10 rounded-lg text-sm"
									style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); {data.emailStatus.configuredViaEnv ? 'opacity: 0.5;' : ''}"
								/>
								<button
									type="button"
									class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-black/10"
									onclick={() => showSmtpPassword = !showSmtpPassword}
								>
									{#if showSmtpPassword}
										<EyeOff class="w-4 h-4" style="color: var(--text-muted);" />
									{:else}
										<Eye class="w-4 h-4" style="color: var(--text-muted);" />
									{/if}
								</button>
							</div>
						</div>
					</div>

					<!-- From Address -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="email.from_address" class="font-medium" style="color: var(--text-primary);">From Address</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">Email address shown as sender</p>
						</div>
						<div class="w-72">
							<input
								type="text"
								id="email.from_address"
								value={editedSettings['email.from_address'] ?? 'BookShelf <noreply@bookshelf.local>'}
								oninput={(e) => updateSetting('email.from_address', (e.target as HTMLInputElement).value)}
								disabled={!data.isAdmin || data.emailStatus.configuredViaEnv}
								placeholder="BookShelf <noreply@example.com>"
								class="w-full px-3 py-2 rounded-lg text-sm"
								style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); {data.emailStatus.configuredViaEnv ? 'opacity: 0.5;' : ''}"
							/>
						</div>
					</div>
				</div>

				<!-- Test Email Section -->
				<div class="p-4 border-t" style="border-color: var(--border-color);">
					<h3 class="font-medium mb-3" style="color: var(--text-primary);">Test Email Configuration</h3>
					<div class="flex gap-3">
						<input
							type="email"
							placeholder="Enter email to send test"
							bind:value={testEmailAddress}
							disabled={!data.isAdmin}
							class="flex-1 px-3 py-2 rounded-lg text-sm"
							style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
						/>
						<button
							type="button"
							class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
							style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
							onclick={sendTestEmail}
							disabled={testingEmail || !data.isAdmin}
						>
							{#if testingEmail}
								<Loader2 class="w-4 h-4 animate-spin" />
								Sending...
							{:else}
								<Send class="w-4 h-4" />
								Send Test
							{/if}
						</button>
					</div>
					{#if emailTestResult}
						<p class="mt-2 text-sm" style="color: {emailTestResult.success ? '#22c55e' : '#ef4444'};">
							{emailTestResult.message}
						</p>
					{/if}
				</div>
			</div>

			<!-- Email info box -->
			<div class="p-4 rounded-lg" style="background: var(--bg-secondary);">
				<h3 class="font-medium mb-2" style="color: var(--text-primary);">About Email Configuration</h3>
				<p class="text-sm" style="color: var(--text-muted);">
					Email is used for password resets, email verification, and notifications.
					You can configure SMTP using environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE)
					or through the settings above. Environment variables take precedence.
				</p>
			</div>

		{:else if activeTab === 'notifications'}
			<!-- ntfy Notifications Tab -->
			<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary);">
				<div class="p-4 border-b flex items-center gap-3" style="border-color: var(--border-color);">
					<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: linear-gradient(135deg, #f59e0b, #ef4444);">
						<Bell class="w-5 h-5 text-white" />
					</div>
					<div>
						<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Push Notifications (ntfy)</h2>
						<p class="text-sm" style="color: var(--text-muted);">Send push notifications via ntfy server</p>
					</div>
				</div>

				<div class="divide-y" style="border-color: var(--border-color);">
					<!-- Enable Toggle -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label class="font-medium" style="color: var(--text-primary);">Enable ntfy Notifications</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">Allow users to receive push notifications via ntfy</p>
						</div>
						<div class="w-72">
							<button
								type="button"
								class="toggle-switch {editedSettings['notifications.ntfy_enabled'] === 'true' ? 'active' : ''}"
								onclick={() => updateSetting('notifications.ntfy_enabled', editedSettings['notifications.ntfy_enabled'] === 'true' ? 'false' : 'true')}
								disabled={!data.isAdmin}
								role="switch"
								aria-checked={editedSettings['notifications.ntfy_enabled'] === 'true'}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>
					</div>

					<!-- ntfy Server URL -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="notifications.ntfy_url" class="font-medium" style="color: var(--text-primary);">ntfy Server URL</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">URL of your ntfy server (use https://ntfy.sh for the public server)</p>
						</div>
						<div class="w-72">
							<input
								type="url"
								id="notifications.ntfy_url"
								value={editedSettings['notifications.ntfy_url'] ?? 'https://ntfy.sh'}
								oninput={(e) => updateSetting('notifications.ntfy_url', (e.target as HTMLInputElement).value)}
								disabled={!data.isAdmin}
								placeholder="https://ntfy.sh"
								class="w-full px-3 py-2 rounded-lg text-sm"
								style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
							/>
						</div>
					</div>

					<!-- Admin Topic -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="notifications.ntfy_admin_topic" class="font-medium" style="color: var(--text-primary);">Admin Topic</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">Topic for system notifications (backups, updates). Leave empty to disable.</p>
						</div>
						<div class="w-72">
							<input
								type="text"
								id="notifications.ntfy_admin_topic"
								value={editedSettings['notifications.ntfy_admin_topic'] ?? ''}
								oninput={(e) => updateSetting('notifications.ntfy_admin_topic', (e.target as HTMLInputElement).value)}
								disabled={!data.isAdmin}
								placeholder="bookshelf-admin"
								class="w-full px-3 py-2 rounded-lg text-sm"
								style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
							/>
						</div>
					</div>
				</div>

				<!-- Test Notification Section -->
				<div class="p-4 border-t" style="border-color: var(--border-color);">
					<h3 class="font-medium mb-3" style="color: var(--text-primary);">Test Admin Notifications</h3>
					<div class="flex gap-3 items-center">
						<button
							type="button"
							class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
							style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
							onclick={sendTestNtfyNotification}
							disabled={testingNtfy || !data.isAdmin || !editedSettings['notifications.ntfy_admin_topic']}
						>
							{#if testingNtfy}
								<Loader2 class="w-4 h-4 animate-spin" />
								Sending...
							{:else}
								<Send class="w-4 h-4" />
								Send Test Notification
							{/if}
						</button>
						{#if !editedSettings['notifications.ntfy_admin_topic']}
							<span class="text-sm" style="color: var(--text-muted);">Configure admin topic first</span>
						{/if}
					</div>
					{#if ntfyTestResult}
						<p class="mt-2 text-sm" style="color: {ntfyTestResult.success ? '#22c55e' : '#ef4444'};">
							{ntfyTestResult.message}
						</p>
					{/if}
				</div>
			</div>

			<!-- ntfy info box -->
			<div class="p-4 rounded-lg" style="background: var(--bg-secondary);">
				<h3 class="font-medium mb-2" style="color: var(--text-primary);">About ntfy Notifications</h3>
				<p class="text-sm" style="color: var(--text-muted);">
					<a href="https://ntfy.sh" target="_blank" rel="noopener" class="underline" style="color: var(--accent);">ntfy</a>
					is a simple HTTP-based pub-sub notification service. Users can configure their own topic in their account settings
					to receive notifications for events like book completions, reading goal milestones, and series completions.
					The admin topic above is for system-wide notifications only.
				</p>
			</div>

		{:else if activeTab === 'ai'}
			<!-- AI Settings Tab -->
			<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary);">
				<div class="p-4 border-b flex items-center gap-3" style="border-color: var(--border-color);">
					<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: linear-gradient(135deg, #4f46e5, #7c3aed);">
						<Sparkles class="w-5 h-5 text-white" />
					</div>
					<div>
						<h2 class="text-lg font-semibold" style="color: var(--text-primary);">AI Recommendations</h2>
						<p class="text-sm" style="color: var(--text-muted);">Configure OpenAI-powered book suggestions</p>
					</div>
				</div>

				<div class="divide-y" style="border-color: var(--border-color);">
					<!-- Enable Toggle -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label class="font-medium" style="color: var(--text-primary);">Enable AI Recommendations</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">Get personalized book recommendations powered by ChatGPT</p>
						</div>
						<div class="w-72">
							<button
								type="button"
								class="toggle-switch {aiEnabled ? 'active' : ''}"
								onclick={() => aiEnabled = !aiEnabled}
								disabled={!data.isAdmin}
								role="switch"
								aria-checked={aiEnabled}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>
					</div>

					<!-- API Key -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="ai-api-key" class="font-medium" style="color: var(--text-primary);">OpenAI API Key</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">
								Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" class="underline" style="color: var(--accent);">platform.openai.com</a>
							</p>
						</div>
						<div class="w-72">
							<div class="relative">
								<input
									type={showApiKey ? 'text' : 'password'}
									id="ai-api-key"
									bind:value={aiApiKey}
									disabled={!data.isAdmin}
									placeholder="sk-..."
									class="w-full px-3 py-2 pr-20 rounded-lg text-sm font-mono"
									style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
								/>
								<div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
									<button type="button" class="p-1.5 rounded hover:bg-black/10" onclick={() => showApiKey = !showApiKey}>
										{#if showApiKey}
											<EyeOff class="w-4 h-4" style="color: var(--text-muted);" />
										{:else}
											<Eye class="w-4 h-4" style="color: var(--text-muted);" />
										{/if}
									</button>
								</div>
							</div>
							<button
								type="button"
								class="mt-2 text-sm px-3 py-1 rounded"
								style="background: var(--bg-tertiary); color: var(--text-secondary);"
								onclick={testAIConnection}
								disabled={testingConnection || !data.isAdmin}
							>
								{#if testingConnection}
									<Loader2 class="w-3 h-3 inline animate-spin mr-1" />
									Testing...
								{:else}
									Test Connection
								{/if}
							</button>
							{#if testResult}
								<p class="mt-2 text-sm" style="color: {testResult.success ? '#22c55e' : '#ef4444'};">
									{testResult.message}
								</p>
							{/if}
						</div>
					</div>

					<!-- Model Selection -->
					<div class="p-4 flex items-start gap-4">
						<div class="flex-1">
							<label for="ai-model" class="font-medium" style="color: var(--text-primary);">AI Model</label>
							<p class="text-sm mt-0.5" style="color: var(--text-muted);">Choose the OpenAI model for recommendations</p>
						</div>
						<div class="w-72">
							<select
								id="ai-model"
								bind:value={aiModel}
								disabled={!data.isAdmin}
								class="w-full px-3 py-2 rounded-lg text-sm"
								style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
							>
								<option value="gpt-4o-mini">GPT-4o Mini (Fastest, Cheapest)</option>
								<option value="gpt-4o">GPT-4o (Best Quality)</option>
								<option value="gpt-4-turbo">GPT-4 Turbo (High Quality)</option>
								<option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>
							</select>
						</div>
					</div>
				</div>
			</div>

		{:else}
			<!-- Dynamic Settings Tabs -->
			{@const tabSettings = getSettingsForTab(activeTab)}

			{#each tabSettings as [category, settings]}
				{@const info = categoryInfo[category] || { icon: Settings, title: category, description: '' }}
				<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary);">
					<div class="p-4 border-b flex items-center gap-3" style="border-color: var(--border-color);">
						<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: var(--bg-tertiary);">
							<svelte:component this={info.icon} class="w-5 h-5" style="color: var(--accent);" />
						</div>
						<div>
							<h2 class="text-lg font-semibold" style="color: var(--text-primary);">{info.title}</h2>
							{#if info.description}
								<p class="text-sm" style="color: var(--text-muted);">{info.description}</p>
							{/if}
						</div>
					</div>

					<div class="divide-y" style="border-color: var(--border-color);">
						{#each settings as setting}
							{@const inputProps = renderInput(setting)}
							{@const isPatternSetting = setting.key.includes('path_pattern')}
							<div class="p-4 flex items-start gap-4">
								<div class="flex-1">
									<label for={setting.key} class="font-medium" style="color: var(--text-primary);">{setting.label}</label>
									<p class="text-sm mt-0.5" style="color: var(--text-muted);">{setting.description}</p>
									{#if isPatternSetting}
										{@const preview = setting.key === 'storage.ebook_path_pattern' ? ebookPatternPreview : setting.key === 'storage.cover_path_pattern' ? coverPatternPreview : audiobookPatternPreview}
										{#if preview}
											<div class="mt-2 flex items-center gap-2">
												<span class="text-xs font-medium" style="color: var(--text-muted);">Preview:</span>
												<code class="text-xs px-2 py-1 rounded" style="background: var(--bg-tertiary); color: var(--accent);">{preview}</code>
											</div>
										{/if}
									{/if}
								</div>
								<div class="w-72">
									{#if setting.key === 'library.default_status'}
										<select
											id={setting.key}
											value={editedSettings[setting.key] ?? ''}
											onchange={(e) => updateSetting(setting.key, (e.target as HTMLSelectElement).value)}
											disabled={!data.isAdmin}
											class="w-full px-3 py-2 rounded-lg text-sm"
											style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
										>
											<option value="">None (no default)</option>
											{#each data.statuses as status}
												<option value={String(status.id)}>{status.name}</option>
											{/each}
										</select>
									{:else if setting.type === 'select' && setting.options}
										<select
											id={setting.key}
											value={editedSettings[setting.key] ?? setting.value}
											onchange={(e) => updateSetting(setting.key, (e.target as HTMLSelectElement).value)}
											disabled={!data.isAdmin}
											class="w-full px-3 py-2 rounded-lg text-sm"
											style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
										>
											{#each setting.options as option}
												<option value={option.value}>{option.label}</option>
											{/each}
										</select>
									{:else if setting.type === 'boolean'}
										<button
											type="button"
											class="toggle-switch {editedSettings[setting.key] === 'true' ? 'active' : ''}"
											onclick={() => updateSetting(setting.key, editedSettings[setting.key] === 'true' ? 'false' : 'true')}
											disabled={!data.isAdmin}
											role="switch"
											aria-checked={editedSettings[setting.key] === 'true'}
										>
											<span class="toggle-knob"></span>
										</button>
									{:else if isPatternSetting}
										<div class="flex gap-2">
											<input
												type="text"
												id={setting.key}
												value={editedSettings[setting.key] ?? setting.value}
												oninput={(e) => {
													const value = (e.target as HTMLInputElement).value;
													updateSetting(setting.key, value);
													const patternType = setting.key === 'storage.ebook_path_pattern' ? 'ebook' : setting.key === 'storage.cover_path_pattern' ? 'cover' : 'audiobook';
													updatePatternPreview(value, patternType);
												}}
												disabled={!data.isAdmin}
												class="w-full px-3 py-2 rounded-lg text-sm font-mono"
												style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
											/>
											<button
												type="button"
												class="p-2 rounded-lg transition-colors"
												style="background: var(--bg-tertiary); color: var(--text-muted);"
												onclick={() => showPatternHelp = !showPatternHelp}
												title="Show available placeholders"
											>
												<HelpCircle class="w-4 h-4" />
											</button>
										</div>
									{:else}
										<input
											type={inputProps.type}
											id={setting.key}
											value={editedSettings[setting.key] ?? setting.value}
											oninput={(e) => updateSetting(setting.key, (e.target as HTMLInputElement).value)}
											disabled={!data.isAdmin}
											class="w-full px-3 py-2 rounded-lg text-sm"
											style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
										/>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Pattern Help Panel - shows after Storage category -->
				{#if category === 'storage' && showPatternHelp}
					<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary); border: 1px solid var(--border-color);">
						<div class="p-4 border-b flex items-center justify-between" style="border-color: var(--border-color);">
							<div class="flex items-center gap-3">
								<FileText class="w-5 h-5" style="color: var(--accent);" />
								<h3 class="font-semibold" style="color: var(--text-primary);">Available Placeholders</h3>
							</div>
							<button
								type="button"
								class="text-sm px-3 py-1 rounded-lg transition-colors"
								style="color: var(--text-muted);"
								onclick={() => showPatternHelp = false}
							>
								Close
							</button>
						</div>
						<div class="p-4">
							<p class="text-sm mb-4" style="color: var(--text-muted);">
								Use these placeholders in your patterns. Wrap sections in <code class="px-1 rounded" style="background: var(--bg-tertiary);">&lt;...&gt;</code> to make them optional.
							</p>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
								{#each placeholders as ph}
									<div class="flex items-start gap-3 p-2 rounded-lg" style="background: var(--bg-tertiary);">
										<code class="text-sm font-bold px-2 py-0.5 rounded" style="background: var(--accent); color: white;">
											{ph.placeholder}
										</code>
										<div class="flex-1 min-w-0">
											<p class="text-sm" style="color: var(--text-primary);">{ph.description}</p>
											<p class="text-xs truncate" style="color: var(--text-muted);">e.g., {ph.example}</p>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			{/each}

			<!-- Storage info box -->
			{#if activeTab === 'storage'}
				<div class="p-4 rounded-lg" style="background: var(--bg-secondary);">
					<h3 class="font-medium mb-2" style="color: var(--text-primary);">About Storage Paths</h3>
					<p class="text-sm" style="color: var(--text-muted);">
						Storage paths can be absolute (starting with /) or relative to the application root.
						When changing storage paths, existing files will NOT be automatically moved.
					</p>
					<div class="mt-3 grid grid-cols-3 gap-4 text-sm">
						<div>
							<span class="font-medium" style="color: var(--text-secondary);">Default Covers:</span>
							<code class="ml-2 px-2 py-0.5 rounded" style="background: var(--bg-tertiary);">./static/covers</code>
						</div>
						<div>
							<span class="font-medium" style="color: var(--text-secondary);">Default Ebooks:</span>
							<code class="ml-2 px-2 py-0.5 rounded" style="background: var(--bg-tertiary);">./static/ebooks</code>
						</div>
						<div>
							<span class="font-medium" style="color: var(--text-secondary);">Default Audiobooks:</span>
							<code class="ml-2 px-2 py-0.5 rounded" style="background: var(--bg-tertiary);">./data/audiobooks</code>
						</div>
					</div>
				</div>
			{/if}

			<!-- Empty state for tabs with no settings -->
			{#if tabSettings.length === 0}
				<div class="rounded-xl p-8 text-center" style="background: var(--bg-secondary);">
					<p style="color: var(--text-muted);">No settings available for this category.</p>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.toggle-switch {
		position: relative;
		width: 44px;
		height: 24px;
		border-radius: 12px;
		background: var(--bg-tertiary);
		border: none;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.toggle-switch:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-switch.active {
		background: var(--accent);
	}

	.toggle-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: white;
		transition: transform 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.toggle-switch.active .toggle-knob {
		transform: translateX(20px);
	}
</style>
