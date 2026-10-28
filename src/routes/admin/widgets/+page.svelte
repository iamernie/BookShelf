<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Check, RefreshCw, Eye, EyeOff, Loader2, LayoutGrid } from 'lucide-svelte';

	let { data } = $props();

	// State
	let token = $state(data.token);
	let enabled = $state(data.enabled);
	let apiEnabled = $state(data.apiEnabled);
	let showToken = $state(false);
	let copied = $state<string | null>(null);
	let regenerating = $state(false);
	let showRegenerateConfirm = $state(false);
	let busyWidgetId = $state<number | null>(null);

	const typeLabels: Record<string, string> = {
		'currently-reading': 'Currently Reading',
		'recent-reads': 'Recent Reads',
		stats: 'Reading Stats',
		goal: 'Reading Goal',
		'next-up': 'Next Up',
		'upcoming-releases': 'Upcoming Releases'
	};

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function copyToClipboard(text: string, type: string) {
		await navigator.clipboard.writeText(text);
		copied = type;
		setTimeout(() => (copied = null), 2000);
	}
</script>

<svelte:head>
	<title>Widgets & API - BookShelf Admin</title>
</svelte:head>

<div class="p-6 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Widgets & API</h1>
		<p style="color: var(--text-secondary);">
			Control public widgets and the v1 API. Users create their own widgets under Account &gt; Widgets.
		</p>
	</div>

	<!-- Enable/Disable Toggle -->
	<div class="card p-4 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-semibold" style="color: var(--text-primary);">Widget Access</h3>
				<p class="text-sm" style="color: var(--text-muted);">
					{enabled ? 'Public widgets are enabled' : 'Public widgets are disabled'}. When off, every
					user's widget URLs return Not found. Off by default.
				</p>
			</div>
			<form
				method="POST"
				action="?/toggleEnabled"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success' && result.data) {
							enabled = result.data.enabled as boolean;
						}
					};
				}}
			>
				<input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
				<button
					type="submit"
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
					style="background-color: {enabled ? 'var(--accent)' : 'var(--bg-tertiary)'};"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
						style="transform: translateX({enabled ? '24px' : '4px'});"
					></span>
				</button>
			</form>
		</div>
	</div>

	<!-- API Enable/Disable Toggle -->
	<div class="card p-4 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-semibold" style="color: var(--text-primary);">API Access</h3>
				<p class="text-sm" style="color: var(--text-muted);">
					{apiEnabled ? 'The v1 API is enabled' : 'The v1 API is disabled'}. Lets scripts and
					automations read and edit your library over /api/v1 using the API token. On by default.
				</p>
			</div>
			<form
				method="POST"
				action="?/toggleApiEnabled"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success' && result.data) {
							apiEnabled = result.data.apiEnabled as boolean;
						}
					};
				}}
			>
				<input type="hidden" name="enabled" value={apiEnabled ? 'false' : 'true'} />
				<button
					type="submit"
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
					style="background-color: {apiEnabled ? 'var(--accent)' : 'var(--bg-tertiary)'};"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
						style="transform: translateX({apiEnabled ? '24px' : '4px'});"
					></span>
				</button>
			</form>
		</div>
	</div>

	{#if apiEnabled}
		<!-- Token Management -->
		<div class="card p-4 mb-6">
			<h3 class="font-semibold mb-3" style="color: var(--text-primary);">API Token</h3>
			<p class="text-sm mb-4" style="color: var(--text-muted);">
				This token authenticates the v1 API (used by external automations). Widgets don't need a
				token. Keep it private.
			</p>

			<div class="flex items-center gap-3 mb-4">
				<div class="flex-1 relative">
					<input
						type={showToken ? 'text' : 'password'}
						value={token}
						readonly
						class="input w-full pr-20 font-mono text-sm"
					/>
					<div class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
						<button
							type="button"
							class="p-1.5 rounded hover:bg-black/10"
							onclick={() => (showToken = !showToken)}
						>
							{#if showToken}
								<EyeOff class="w-4 h-4" style="color: var(--text-muted);" />
							{:else}
								<Eye class="w-4 h-4" style="color: var(--text-muted);" />
							{/if}
						</button>
						<button
							type="button"
							class="p-1.5 rounded hover:bg-black/10"
							onclick={() => copyToClipboard(token, 'token')}
						>
							{#if copied === 'token'}
								<Check class="w-4 h-4 text-green-500" />
							{:else}
								<Copy class="w-4 h-4" style="color: var(--text-muted);" />
							{/if}
						</button>
					</div>
				</div>

				<button
					type="button"
					class="btn-secondary flex items-center gap-2"
					onclick={() => (showRegenerateConfirm = true)}
				>
					<RefreshCw class="w-4 h-4" />
					Regenerate
				</button>
			</div>
		</div>
	{/if}

	<!-- Widget Registry -->
	<div class="card p-4">
		<div class="flex items-center gap-2 mb-1">
			<LayoutGrid class="w-5 h-5" style="color: var(--accent);" />
			<h3 class="font-semibold" style="color: var(--text-primary);">Widget Registry</h3>
		</div>
		<p class="text-sm mb-4" style="color: var(--text-muted);">
			Every widget users have created. Disabling one makes its URL return Not found; the owner
			can't undo it by rotating the key.
		</p>

		{#if data.widgets.length === 0}
			<p class="text-sm py-6 text-center" style="color: var(--text-muted);">No widgets yet</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left" style="color: var(--text-muted);">
							<th class="py-2 pr-4 font-medium">Owner</th>
							<th class="py-2 pr-4 font-medium">Name</th>
							<th class="py-2 pr-4 font-medium">Type</th>
							<th class="py-2 pr-4 font-medium">Created</th>
							<th class="py-2 pr-4 font-medium">Last fetched</th>
							<th class="py-2 pr-4 font-medium">Status</th>
							<th class="py-2 font-medium"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.widgets as widget (widget.id)}
							<tr class="border-t" style="border-color: var(--border-color); color: var(--text-primary);">
								<td class="py-2 pr-4">{widget.ownerUsername ?? `#${widget.ownerId}`}</td>
								<td class="py-2 pr-4">{widget.name ?? '—'}</td>
								<td class="py-2 pr-4">{typeLabels[widget.type] ?? widget.type}</td>
								<td class="py-2 pr-4" style="color: var(--text-muted);">{formatDate(widget.createdAt)}</td>
								<td class="py-2 pr-4" style="color: var(--text-muted);">{formatDate(widget.lastFetchedAt)}</td>
								<td class="py-2 pr-4">
									{#if widget.disabledAt}
										<span
											class="text-xs px-2 py-0.5 rounded-full"
											style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"
										>
											Disabled
										</span>
									{:else}
										<span
											class="text-xs px-2 py-0.5 rounded-full"
											style="background: rgba(34, 197, 94, 0.1); color: #22c55e;"
										>
											Active
										</span>
									{/if}
								</td>
								<td class="py-2 text-right">
									<form
										method="POST"
										action={widget.disabledAt ? '?/enableWidget' : '?/disableWidget'}
										use:enhance={() => {
											busyWidgetId = widget.id;
											return async ({ update }) => {
												await update();
												busyWidgetId = null;
											};
										}}
									>
										<input type="hidden" name="id" value={widget.id} />
										<button
											type="submit"
											class="btn-secondary text-xs px-3 py-1 flex items-center gap-1 ml-auto"
											disabled={busyWidgetId === widget.id}
										>
											{#if busyWidgetId === widget.id}
												<Loader2 class="w-3 h-3 animate-spin" />
											{/if}
											{widget.disabledAt ? 'Enable' : 'Disable'}
										</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Regenerate Token Confirmation Modal -->
{#if showRegenerateConfirm}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background-color: rgba(0,0,0,0.5);"
	>
		<div class="card p-6 max-w-md w-full">
			<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
				Regenerate Token?
			</h3>
			<p class="mb-4" style="color: var(--text-muted);">
				This will invalidate the current API token. Any external tools using the v1 API will need the
				new token. Widget embeds are not affected.
			</p>
			<div class="flex gap-3 justify-end">
				<button type="button" class="btn-secondary" onclick={() => (showRegenerateConfirm = false)}>
					Cancel
				</button>
				<form
					method="POST"
					action="?/regenerateToken"
					use:enhance={() => {
						regenerating = true;
						return async ({ result }) => {
							regenerating = false;
							showRegenerateConfirm = false;
							if (result.type === 'success' && result.data) {
								token = result.data.token as string;
							}
						};
					}}
				>
					<button type="submit" class="btn-accent flex items-center gap-2" disabled={regenerating}>
						{#if regenerating}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							<RefreshCw class="w-4 h-4" />
						{/if}
						Regenerate
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}
