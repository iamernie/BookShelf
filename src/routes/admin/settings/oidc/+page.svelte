<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Shield,
		Plus,
		Trash2,
		Edit,
		Save,
		X,
		Loader2,
		Check,
		AlertCircle,
		TestTube,
		ExternalLink,
		Eye,
		EyeOff,
		ChevronLeft
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	interface Provider {
		id: number;
		name: string;
		slug: string;
		issuerUrl: string;
		clientId: string;
		clientSecret: string;
		scopes: string | null;
		enabled: boolean | null;
		autoCreateUsers: boolean | null;
		defaultRole: string | null;
		iconUrl: string | null;
		buttonColor: string | null;
		displayOrder: number | null;
	}

	interface Preset {
		name: string;
		issuerUrl: string;
		scopes: readonly string[];
		buttonColor: string;
		iconUrl: string;
		note?: string;
	}

	let { data } = $props();

	let providers = $state<Provider[]>(data.providers as Provider[]);
	let presets = $state<Record<string, Preset>>(data.presets as unknown as Record<string, Preset>);

	// Modal state
	let showModal = $state(false);
	let editingProvider = $state<Provider | null>(null);
	let isNew = $state(false);

	// Form state
	let formData = $state({
		name: '',
		slug: '',
		issuerUrl: '',
		clientId: '',
		clientSecret: '',
		scopes: '["openid", "profile", "email"]',
		enabled: true,
		autoCreateUsers: false,
		defaultRole: 'member',
		iconUrl: '',
		buttonColor: ''
	});

	let saving = $state(false);
	let testing = $state(false);
	let testResult = $state<{ success: boolean; error?: string } | null>(null);
	let showSecret = $state(false);
	let deleting = $state<number | null>(null);

	function openNewModal() {
		isNew = true;
		editingProvider = null;
		formData = {
			name: '',
			slug: '',
			issuerUrl: '',
			clientId: '',
			clientSecret: '',
			scopes: '["openid", "profile", "email"]',
			enabled: true,
			autoCreateUsers: false,
			defaultRole: 'member',
			iconUrl: '',
			buttonColor: ''
		};
		testResult = null;
		showSecret = false;
		showModal = true;
	}

	function openEditModal(provider: Provider) {
		isNew = false;
		editingProvider = provider;
		formData = {
			name: provider.name,
			slug: provider.slug,
			issuerUrl: provider.issuerUrl,
			clientId: provider.clientId,
			clientSecret: provider.clientSecret,
			scopes: provider.scopes || '["openid", "profile", "email"]',
			enabled: provider.enabled ?? true,
			autoCreateUsers: provider.autoCreateUsers ?? false,
			defaultRole: provider.defaultRole || 'member',
			iconUrl: provider.iconUrl || '',
			buttonColor: provider.buttonColor || ''
		};
		testResult = null;
		showSecret = false;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingProvider = null;
		testResult = null;
	}

	function applyPreset(presetKey: string) {
		const preset = presets[presetKey];
		if (preset) {
			formData.name = preset.name;
			formData.issuerUrl = preset.issuerUrl;
			formData.scopes = JSON.stringify(preset.scopes);
			formData.buttonColor = preset.buttonColor;
			formData.iconUrl = preset.iconUrl;
		}
	}

	async function testConnection() {
		if (!formData.issuerUrl || !formData.clientId || !formData.clientSecret) {
			testResult = { success: false, error: 'Fill in issuer URL, client ID, and client secret first' };
			return;
		}

		testing = true;
		testResult = null;

		try {
			const res = await fetch('/api/admin/oidc/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					issuerUrl: formData.issuerUrl,
					clientId: formData.clientId,
					clientSecret: formData.clientSecret === '••••••••' && editingProvider
						? undefined // Let server use existing
						: formData.clientSecret
				})
			});

			const data = await res.json();
			testResult = data;
		} catch {
			testResult = { success: false, error: 'Connection test failed' };
		} finally {
			testing = false;
		}
	}

	async function saveProvider() {
		saving = true;

		try {
			const url = isNew
				? '/api/admin/oidc/providers'
				: `/api/admin/oidc/providers/${editingProvider?.id}`;

			const method = isNew ? 'POST' : 'PATCH';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const result = await res.json();

			if (!res.ok) {
				if (result.validationFailed) {
					testResult = { success: false, error: result.error };
				} else {
					toasts.error(result.message || result.error || 'Failed to save provider');
				}
				return;
			}

			toasts.success(isNew ? 'Provider created' : 'Provider updated');
			closeModal();
			await invalidateAll();
			providers = (await (await fetch('/api/admin/oidc/providers')).json()).providers;
		} catch {
			toasts.error('An error occurred');
		} finally {
			saving = false;
		}
	}

	async function deleteProvider(id: number) {
		if (!confirm('Are you sure you want to delete this provider? Users linked to it will need to re-link their accounts.')) {
			return;
		}

		deleting = id;

		try {
			const res = await fetch(`/api/admin/oidc/providers/${id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				toasts.error('Failed to delete provider');
				return;
			}

			toasts.success('Provider deleted');
			providers = providers.filter((p) => p.id !== id);
		} catch {
			toasts.error('An error occurred');
		} finally {
			deleting = null;
		}
	}

	async function toggleEnabled(provider: Provider) {
		try {
			const res = await fetch(`/api/admin/oidc/providers/${provider.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: !provider.enabled })
			});

			if (!res.ok) {
				toasts.error('Failed to update provider');
				return;
			}

			provider.enabled = !provider.enabled;
			providers = [...providers];
		} catch {
			toasts.error('An error occurred');
		}
	}
</script>

<svelte:head>
	<title>OIDC Settings - Admin - BookShelf</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<!-- Back link -->
	<a href="/admin/settings" class="flex items-center gap-2 text-sm mb-6 hover:underline" style="color: var(--text-muted);">
		<ChevronLeft class="w-4 h-4" />
		Back to Settings
	</a>

	<div class="flex items-center justify-between mb-8">
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: var(--bg-tertiary);">
				<Shield class="w-5 h-5" style="color: var(--accent);" />
			</div>
			<div>
				<h1 class="text-2xl font-bold" style="color: var(--text-primary);">OIDC Authentication</h1>
				<p class="text-sm" style="color: var(--text-muted);">Configure external identity providers (SSO)</p>
			</div>
		</div>

		<button
			type="button"
			class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
			style="background: var(--accent); color: white;"
			onclick={openNewModal}
		>
			<Plus class="w-4 h-4" />
			Add Provider
		</button>
	</div>

	<!-- Info Box -->
	<div class="rounded-lg p-4 mb-6" style="background: var(--bg-tertiary); border: 1px solid var(--border-color);">
		<p class="text-sm" style="color: var(--text-secondary);">
			OIDC (OpenID Connect) allows users to sign in with external identity providers like Authentik, Keycloak, or Google.
			Local email/password login always remains available.
		</p>
	</div>

	<!-- Setup Instructions -->
	<details class="rounded-lg mb-6" style="background: var(--bg-secondary); border: 1px solid var(--border-color);">
		<summary class="cursor-pointer p-4 flex items-center gap-2 font-medium" style="color: var(--text-primary);">
			<AlertCircle class="w-5 h-5" style="color: var(--accent);" />
			Setup Instructions & Provider Documentation
		</summary>

		<div class="px-4 pb-4 space-y-4">
			<!-- Redirect URI Info -->
			<div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
				<p class="text-sm font-medium mb-2" style="color: var(--text-primary);">Redirect URI (Callback URL)</p>
				<p class="text-xs mb-2" style="color: var(--text-muted);">Configure this in your identity provider:</p>
				<code class="block text-xs px-3 py-2 rounded select-all" style="background: var(--bg-primary); color: var(--accent);">
					{typeof window !== 'undefined' ? window.location.origin : 'https://your-bookshelf-url'}/auth/oidc/callback
				</code>
			</div>

			<!-- Provider Guides -->
			<div class="space-y-3">
				<p class="text-sm font-medium" style="color: var(--text-primary);">Provider Setup Guides</p>

				<!-- Authentik -->
				<div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
					<div class="flex items-center justify-between mb-2">
						<span class="font-medium text-sm" style="color: var(--text-primary);">Authentik</span>
						<a
							href="https://docs.goauthentik.io/docs/applications"
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs flex items-center gap-1 hover:underline"
							style="color: var(--accent);"
						>
							Documentation <ExternalLink class="w-3 h-3" />
						</a>
					</div>
					<ol class="text-xs space-y-1 list-decimal list-inside" style="color: var(--text-muted);">
						<li>Go to <strong>Applications → Providers</strong>, create an <strong>OAuth2/OpenID Provider</strong></li>
						<li>Set the Redirect URI to the callback URL above</li>
						<li>Go to <strong>Applications → Applications</strong>, create a new application and link the provider</li>
						<li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from the provider settings</li>
						<li>Issuer URL format: <code style="color: var(--accent);">https://authentik.example.com/application/o/your-app-slug/</code></li>
					</ol>
				</div>

				<!-- Keycloak -->
				<div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
					<div class="flex items-center justify-between mb-2">
						<span class="font-medium text-sm" style="color: var(--text-primary);">Keycloak</span>
						<a
							href="https://www.keycloak.org/docs/latest/server_admin/#_oidc_clients"
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs flex items-center gap-1 hover:underline"
							style="color: var(--accent);"
						>
							Documentation <ExternalLink class="w-3 h-3" />
						</a>
					</div>
					<ol class="text-xs space-y-1 list-decimal list-inside" style="color: var(--text-muted);">
						<li>Go to <strong>Clients</strong> and click <strong>Create client</strong></li>
						<li>Set Client type to <strong>OpenID Connect</strong></li>
						<li>Enable <strong>Client authentication</strong> for confidential access</li>
						<li>Add the Redirect URI to <strong>Valid redirect URIs</strong></li>
						<li>Issuer URL format: <code style="color: var(--accent);">https://keycloak.example.com/realms/your-realm</code></li>
					</ol>
				</div>

				<!-- Google -->
				<div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
					<div class="flex items-center justify-between mb-2">
						<span class="font-medium text-sm" style="color: var(--text-primary);">Google</span>
						<a
							href="https://developers.google.com/identity/openid-connect/openid-connect"
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs flex items-center gap-1 hover:underline"
							style="color: var(--accent);"
						>
							Documentation <ExternalLink class="w-3 h-3" />
						</a>
					</div>
					<ol class="text-xs space-y-1 list-decimal list-inside" style="color: var(--text-muted);">
						<li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" class="hover:underline" style="color: var(--accent);">Google Cloud Console</a></li>
						<li>Create a new <strong>OAuth 2.0 Client ID</strong> (Web application type)</li>
						<li>Add the Redirect URI to <strong>Authorized redirect URIs</strong></li>
						<li>Issuer URL: <code style="color: var(--accent);">https://accounts.google.com</code></li>
					</ol>
				</div>

				<!-- GitHub -->
				<div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
					<div class="flex items-center justify-between mb-2">
						<span class="font-medium text-sm" style="color: var(--text-primary);">GitHub</span>
						<a
							href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs flex items-center gap-1 hover:underline"
							style="color: var(--accent);"
						>
							Documentation <ExternalLink class="w-3 h-3" />
						</a>
					</div>
					<ol class="text-xs space-y-1 list-decimal list-inside" style="color: var(--text-muted);">
						<li>Go to <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" class="hover:underline" style="color: var(--accent);">GitHub Developer Settings</a></li>
						<li>Click <strong>New OAuth App</strong></li>
						<li>Set Authorization callback URL to the Redirect URI above</li>
						<li>Note: GitHub uses OAuth2, not full OIDC. Use issuer: <code style="color: var(--accent);">https://github.com</code></li>
					</ol>
				</div>
			</div>

			<!-- Troubleshooting -->
			<div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
				<p class="text-sm font-medium mb-2" style="color: var(--text-primary);">Troubleshooting</p>
				<ul class="text-xs space-y-1" style="color: var(--text-muted);">
					<li>• <strong>Redirect URI mismatch:</strong> Ensure the callback URL in your provider exactly matches (including trailing slashes)</li>
					<li>• <strong>Invalid issuer:</strong> The issuer URL should NOT include <code>.well-known/openid-configuration</code></li>
					<li>• <strong>Connection failed:</strong> Verify your server can reach the identity provider (check firewall/DNS)</li>
					<li>• <strong>Missing claims:</strong> Ensure your provider is configured to include <code>email</code> and <code>name</code> claims</li>
				</ul>
			</div>
		</div>
	</details>

	<!-- Providers List -->
	{#if providers.length === 0}
		<div class="text-center py-12 rounded-lg" style="background: var(--bg-secondary);">
			<Shield class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="text-lg font-medium mb-2" style="color: var(--text-primary);">No providers configured</h3>
			<p class="text-sm mb-4" style="color: var(--text-muted);">Add an OIDC provider to enable single sign-on.</p>
			<button
				type="button"
				class="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
				style="background: var(--accent); color: white;"
				onclick={openNewModal}
			>
				<Plus class="w-4 h-4" />
				Add Provider
			</button>
		</div>
	{:else}
		<div class="space-y-4">
			{#each providers as provider}
				<div class="rounded-lg p-4" style="background: var(--bg-secondary); border: 1px solid var(--border-color);">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-4">
							{#if provider.iconUrl}
								<img src={provider.iconUrl} alt="" class="w-10 h-10 rounded" />
							{:else}
								<div
									class="w-10 h-10 rounded flex items-center justify-center text-white font-bold"
									style="background: {provider.buttonColor || 'var(--accent)'};"
								>
									{provider.name.charAt(0)}
								</div>
							{/if}

							<div>
								<div class="flex items-center gap-2">
									<h3 class="font-medium" style="color: var(--text-primary);">{provider.name}</h3>
									{#if provider.enabled}
										<span class="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
											Enabled
										</span>
									{:else}
										<span class="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400">
											Disabled
										</span>
									{/if}
								</div>
								<p class="text-sm" style="color: var(--text-muted);">{provider.issuerUrl}</p>
							</div>
						</div>

						<div class="flex items-center gap-2">
							<button
								type="button"
								class="p-2 rounded-lg hover:bg-black/10"
								title={provider.enabled ? 'Disable' : 'Enable'}
								onclick={() => toggleEnabled(provider)}
							>
								{#if provider.enabled}
									<Check class="w-4 h-4 text-green-400" />
								{:else}
									<X class="w-4 h-4" style="color: var(--text-muted);" />
								{/if}
							</button>

							<button
								type="button"
								class="p-2 rounded-lg hover:bg-black/10"
								title="Edit"
								onclick={() => openEditModal(provider)}
							>
								<Edit class="w-4 h-4" style="color: var(--text-muted);" />
							</button>

							<button
								type="button"
								class="p-2 rounded-lg hover:bg-red-500/10"
								title="Delete"
								onclick={() => deleteProvider(provider.id)}
								disabled={deleting === provider.id}
							>
								{#if deleting === provider.id}
									<Loader2 class="w-4 h-4 animate-spin" style="color: var(--text-muted);" />
								{:else}
									<Trash2 class="w-4 h-4 text-red-400" />
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/50"
			onclick={closeModal}
			onkeydown={(e) => e.key === 'Escape' && closeModal()}
			role="button"
			tabindex="-1"
		></div>

		<!-- Modal Content -->
		<div class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl" style="background: var(--bg-secondary);">
			<div class="sticky top-0 flex items-center justify-between p-4 border-b" style="background: var(--bg-secondary); border-color: var(--border-color);">
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					{isNew ? 'Add OIDC Provider' : 'Edit Provider'}
				</h2>
				<button type="button" class="p-2 rounded-lg hover:bg-black/10" onclick={closeModal}>
					<X class="w-5 h-5" style="color: var(--text-muted);" />
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); saveProvider(); }} class="p-6 space-y-6">
				<!-- Presets -->
				{#if isNew}
					<div>
						<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Quick Setup (Optional)
						</label>
						<div class="flex flex-wrap gap-2">
							{#each Object.entries(presets) as [key, preset]}
								<button
									type="button"
									class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
									style="background: var(--bg-tertiary); border-color: var(--border-color); color: var(--text-secondary);"
									onclick={() => applyPreset(key)}
								>
									{preset.name}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Name -->
				<div>
					<label for="name" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Display Name *
					</label>
					<input
						id="name"
						type="text"
						bind:value={formData.name}
						required
						placeholder="e.g., Google, Authentik"
						class="w-full px-3 py-2 rounded-lg"
						style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
					/>
				</div>

				<!-- Issuer URL -->
				<div>
					<label for="issuerUrl" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Issuer URL *
					</label>
					<input
						id="issuerUrl"
						type="url"
						bind:value={formData.issuerUrl}
						required
						placeholder="https://accounts.google.com"
						class="w-full px-3 py-2 rounded-lg"
						style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
					/>
					<p class="text-xs mt-1" style="color: var(--text-muted);">
						The OIDC issuer URL (usually ends with /.well-known/openid-configuration)
					</p>
				</div>

				<!-- Client ID & Secret -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="clientId" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Client ID *
						</label>
						<input
							id="clientId"
							type="text"
							bind:value={formData.clientId}
							required
							class="w-full px-3 py-2 rounded-lg"
							style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
						/>
					</div>

					<div>
						<label for="clientSecret" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Client Secret *
						</label>
						<div class="relative">
							<input
								id="clientSecret"
								type={showSecret ? 'text' : 'password'}
								bind:value={formData.clientSecret}
								required
								class="w-full px-3 py-2 pr-10 rounded-lg"
								style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
							/>
							<button
								type="button"
								class="absolute right-2 top-1/2 -translate-y-1/2"
								onclick={() => showSecret = !showSecret}
							>
								{#if showSecret}
									<EyeOff class="w-4 h-4" style="color: var(--text-muted);" />
								{:else}
									<Eye class="w-4 h-4" style="color: var(--text-muted);" />
								{/if}
							</button>
						</div>
					</div>
				</div>

				<!-- Test Connection -->
				<div class="flex items-center gap-4">
					<button
						type="button"
						class="flex items-center gap-2 px-4 py-2 rounded-lg"
						style="background: var(--bg-tertiary); color: var(--text-secondary);"
						onclick={testConnection}
						disabled={testing}
					>
						{#if testing}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							<TestTube class="w-4 h-4" />
						{/if}
						Test Connection
					</button>

					{#if testResult}
						<span class="text-sm" style="color: {testResult.success ? '#22c55e' : '#ef4444'};">
							{testResult.success ? 'Connection successful!' : testResult.error}
						</span>
					{/if}
				</div>

				<!-- Advanced Settings -->
				<details class="group">
					<summary class="cursor-pointer text-sm font-medium" style="color: var(--text-secondary);">
						Advanced Settings
					</summary>

					<div class="mt-4 space-y-4 pl-4 border-l-2" style="border-color: var(--border-color);">
						<!-- Scopes -->
						<div>
							<label for="scopes" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Scopes (JSON array)
							</label>
							<input
								id="scopes"
								type="text"
								bind:value={formData.scopes}
								placeholder='["openid", "profile", "email"]'
								class="w-full px-3 py-2 rounded-lg font-mono text-sm"
								style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
							/>
						</div>

						<!-- Default Role -->
						<div>
							<label for="defaultRole" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Default Role for New Users
							</label>
							<select
								id="defaultRole"
								bind:value={formData.defaultRole}
								class="w-full px-3 py-2 rounded-lg"
								style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
							>
								<option value="member">Member</option>
								<option value="viewer">Viewer</option>
								<option value="librarian">Librarian</option>
								<option value="admin">Admin</option>
							</select>
						</div>

						<!-- Button Color -->
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="buttonColor" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
									Button Color
								</label>
								<div class="flex gap-2">
									<input
										id="buttonColor"
										type="text"
										bind:value={formData.buttonColor}
										placeholder="#4285f4"
										class="flex-1 px-3 py-2 rounded-lg"
										style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
									/>
									<input
										type="color"
										bind:value={formData.buttonColor}
										class="w-10 h-10 rounded cursor-pointer"
									/>
								</div>
							</div>

							<div>
								<label for="iconUrl" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
									Icon URL
								</label>
								<input
									id="iconUrl"
									type="url"
									bind:value={formData.iconUrl}
									placeholder="/icons/provider.svg"
									class="w-full px-3 py-2 rounded-lg"
									style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
								/>
							</div>
						</div>

						<!-- Auto Create Users -->
						<label class="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style="background: var(--bg-tertiary);">
							<input
								type="checkbox"
								bind:checked={formData.autoCreateUsers}
								class="w-4 h-4 rounded"
							/>
							<div>
								<p class="font-medium" style="color: var(--text-primary);">Auto-create users</p>
								<p class="text-xs" style="color: var(--text-muted);">
									Automatically create accounts for new OIDC users (follows registration settings)
								</p>
							</div>
						</label>
					</div>
				</details>

				<!-- Actions -->
				<div class="flex justify-end gap-3 pt-4 border-t" style="border-color: var(--border-color);">
					<button
						type="button"
						class="px-4 py-2 rounded-lg"
						style="background: var(--bg-tertiary); color: var(--text-secondary);"
						onclick={closeModal}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
						style="background: var(--accent); color: white;"
						disabled={saving}
					>
						{#if saving}
							<Loader2 class="w-4 h-4 animate-spin" />
							Saving...
						{:else}
							<Save class="w-4 h-4" />
							{isNew ? 'Create Provider' : 'Save Changes'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
