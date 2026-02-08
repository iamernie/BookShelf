<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Key,
		Plus,
		Trash2,
		Copy,
		Check,
		Loader2,
		Eye,
		EyeOff,
		Clock,
		AlertCircle,
		Calendar,
		Info
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let { data } = $props();

	let showCreateModal = $state(false);
	let newTokenName = $state('');
	let newTokenExpiry = $state<string>('');
	let creating = $state(false);
	let createdToken = $state<string | null>(null);
	let showCreatedToken = $state(true);
	let copied = $state(false);
	let deletingTokenId = $state<number | null>(null);

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
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

	function isExpired(expiresAt: string | null): boolean {
		if (!expiresAt) return false;
		return new Date(expiresAt) < new Date();
	}

	async function createToken() {
		if (!newTokenName.trim()) {
			toasts.error('Token name is required');
			return;
		}

		creating = true;
		try {
			const body: { name: string; expiresAt?: string } = {
				name: newTokenName.trim()
			};

			if (newTokenExpiry) {
				body.expiresAt = new Date(newTokenExpiry).toISOString();
			}

			const res = await fetch('/api/tokens', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				const result = await res.json();
				createdToken = result.token;
				newTokenName = '';
				newTokenExpiry = '';
				invalidateAll();
			} else {
				const result = await res.json();
				toasts.error(result.message || 'Failed to create token');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			creating = false;
		}
	}

	async function deleteToken(tokenId: number) {
		if (!confirm('Are you sure you want to revoke this token? Any applications using it will stop working.')) {
			return;
		}

		deletingTokenId = tokenId;
		try {
			const res = await fetch(`/api/tokens/${tokenId}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				toasts.success('Token revoked');
				invalidateAll();
			} else {
				toasts.error('Failed to revoke token');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			deletingTokenId = null;
		}
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			toasts.success('Token copied to clipboard');
			setTimeout(() => (copied = false), 2000);
		} catch {
			toasts.error('Failed to copy');
		}
	}

	function closeCreateModal() {
		showCreateModal = false;
		createdToken = null;
		newTokenName = '';
		newTokenExpiry = '';
	}
</script>

<svelte:head>
	<title>API Tokens | My Account</title>
</svelte:head>

<div class="container mx-auto px-4 py-6 max-w-4xl">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div class="flex items-center gap-3">
			<Key class="w-6 h-6" style="color: var(--accent);" />
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">API Tokens</h1>
		</div>
		<button
			type="button"
			class="btn-primary flex items-center gap-2"
			onclick={() => (showCreateModal = true)}
		>
			<Plus class="w-4 h-4" />
			Create Token
		</button>
	</div>

	<!-- Quick Nav -->
	<div class="flex gap-2 mb-6">
		<a
			href="/account"
			class="px-4 py-2 rounded-lg font-medium"
			style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
		>
			Profile
		</a>
		<a
			href="/account/settings"
			class="px-4 py-2 rounded-lg font-medium"
			style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
		>
			Settings
		</a>
		<a
			href="/account/tokens"
			class="px-4 py-2 rounded-lg font-medium"
			style="background-color: var(--accent); color: white;"
		>
			API Tokens
		</a>
	</div>

	<!-- Info Box -->
	<div
		class="p-4 rounded-lg mb-6 flex gap-3"
		style="background-color: var(--bg-tertiary); border-left: 3px solid var(--accent);"
	>
		<Info class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: var(--accent);" />
		<div class="text-sm" style="color: var(--text-muted);">
			<p class="font-medium" style="color: var(--text-secondary);">API Tokens</p>
			<p class="mt-1">
				Use API tokens to authenticate with the BookShelf API from external applications,
				scripts, or integrations. Tokens provide the same access as your user account.
			</p>
			<p class="mt-2">
				<strong>Usage:</strong> Include the token in your HTTP requests as a Bearer token:
			</p>
			<code
				class="block mt-1 p-2 rounded text-xs"
				style="background-color: var(--bg-secondary);"
			>
				Authorization: Bearer bks_your_token_here
			</code>
		</div>
	</div>

	<!-- Tokens List -->
	<div class="card">
		{#if data.tokens.length === 0}
			<div class="text-center py-12">
				<Key class="w-12 h-12 mx-auto mb-3 opacity-30" style="color: var(--text-muted);" />
				<p class="font-medium" style="color: var(--text-primary);">No API tokens</p>
				<p class="text-sm mt-1" style="color: var(--text-muted);">
					Create a token to access the BookShelf API
				</p>
				<button
					type="button"
					class="btn-primary mt-4 flex items-center gap-2 mx-auto"
					onclick={() => (showCreateModal = true)}
				>
					<Plus class="w-4 h-4" />
					Create Token
				</button>
			</div>
		{:else}
			<div class="divide-y" style="border-color: var(--border-color);">
				{#each data.tokens as token}
					{@const expired = isExpired(token.expiresAt)}
					<div
						class="p-4 flex items-center justify-between gap-4"
						style="opacity: {expired ? 0.5 : 1};"
					>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<p class="font-medium truncate" style="color: var(--text-primary);">
									{token.name}
								</p>
								{#if expired}
									<span
										class="text-xs px-2 py-0.5 rounded-full"
										style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"
									>
										Expired
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-4 mt-1 text-xs" style="color: var(--text-muted);">
								<span class="font-mono">{token.tokenPrefix}...</span>
								<span class="flex items-center gap-1">
									<Clock class="w-3 h-3" />
									Created {formatRelativeTime(token.createdAt)}
								</span>
								{#if token.lastUsedAt}
									<span>Last used {formatRelativeTime(token.lastUsedAt)}</span>
								{:else}
									<span>Never used</span>
								{/if}
								{#if token.expiresAt}
									<span class="flex items-center gap-1">
										<Calendar class="w-3 h-3" />
										{expired ? 'Expired' : 'Expires'} {formatDate(token.expiresAt)}
									</span>
								{/if}
							</div>
						</div>
						<button
							type="button"
							class="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
							title="Revoke token"
							onclick={() => deleteToken(token.id)}
							disabled={deletingTokenId === token.id}
						>
							{#if deletingTokenId === token.id}
								<Loader2 class="w-4 h-4 animate-spin" style="color: var(--text-muted);" />
							{:else}
								<Trash2 class="w-4 h-4 text-red-400" />
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Create Token Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
		<div
			class="rounded-xl shadow-2xl w-full max-w-md"
			style="background-color: var(--bg-secondary);"
		>
			<div
				class="flex items-center justify-between px-6 py-4 border-b"
				style="border-color: var(--border-color);"
			>
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					{createdToken ? 'Token Created' : 'Create API Token'}
				</h2>
				<button
					type="button"
					class="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
					onclick={closeCreateModal}
				>
					<svg
						class="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						style="color: var(--text-muted);"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="p-6 space-y-4">
				{#if createdToken}
					<!-- Token Created View -->
					<div
						class="p-4 rounded-lg flex items-start gap-3"
						style="background: rgba(239, 68, 68, 0.1);"
					>
						<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: #ef4444;" />
						<div class="text-sm" style="color: #ef4444;">
							<p class="font-medium">Copy this token now!</p>
							<p>You won't be able to see it again. Store it securely.</p>
						</div>
					</div>

					<div>
						<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Your API Token
						</label>
						<div class="relative">
							<input
								type={showCreatedToken ? 'text' : 'password'}
								class="form-input w-full pr-20 font-mono text-sm"
								value={createdToken}
								readonly
							/>
							<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
								<button
									type="button"
									class="p-1.5 rounded transition-colors hover:bg-black/10"
									onclick={() => (showCreatedToken = !showCreatedToken)}
									title={showCreatedToken ? 'Hide token' : 'Show token'}
								>
									{#if showCreatedToken}
										<EyeOff class="w-4 h-4" style="color: var(--text-muted);" />
									{:else}
										<Eye class="w-4 h-4" style="color: var(--text-muted);" />
									{/if}
								</button>
								<button
									type="button"
									class="p-1.5 rounded transition-colors hover:bg-black/10"
									onclick={() => copyToClipboard(createdToken || '')}
									title="Copy token"
								>
									{#if copied}
										<Check class="w-4 h-4" style="color: #22c55e;" />
									{:else}
										<Copy class="w-4 h-4" style="color: var(--text-muted);" />
									{/if}
								</button>
							</div>
						</div>
					</div>
				{:else}
					<!-- Create Token Form -->
					<div>
						<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Token Name
						</label>
						<input
							type="text"
							class="form-input w-full"
							placeholder="e.g., My Script, Home Assistant"
							bind:value={newTokenName}
							maxlength="100"
						/>
						<p class="text-xs mt-1" style="color: var(--text-muted);">
							A name to help you identify this token
						</p>
					</div>

					<div>
						<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Expiration (Optional)
						</label>
						<input type="datetime-local" class="form-input w-full" bind:value={newTokenExpiry} />
						<p class="text-xs mt-1" style="color: var(--text-muted);">
							Leave empty for a token that never expires
						</p>
					</div>
				{/if}
			</div>

			<div
				class="flex justify-end gap-3 px-6 py-4 border-t"
				style="border-color: var(--border-color);"
			>
				{#if createdToken}
					<button type="button" class="btn-primary" onclick={closeCreateModal}> Done </button>
				{:else}
					<button type="button" class="btn-ghost" onclick={closeCreateModal}> Cancel </button>
					<button
						type="button"
						class="btn-primary flex items-center gap-2"
						onclick={createToken}
						disabled={creating || !newTokenName.trim()}
					>
						{#if creating}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							<Plus class="w-4 h-4" />
						{/if}
						Create Token
					</button>
				{/if}
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
</style>
