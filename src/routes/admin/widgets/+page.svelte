<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Code,
		Copy,
		Check,
		RefreshCw,
		Eye,
		EyeOff,
		Book,
		CheckCircle,
		BarChart3,
		Target,
		Loader2,
		AlertTriangle
	} from 'lucide-svelte';

	let { data } = $props();

	// State
	let token = $state(data.token);
	let enabled = $state(data.enabled);
	let showToken = $state(false);
	let copied = $state<string | null>(null);
	let regenerating = $state(false);
	let showRegenerateConfirm = $state(false);

	// Widget configuration
	let selectedType = $state<'currently-reading' | 'recent-reads' | 'stats' | 'goal'>('currently-reading');
	let selectedTheme = $state<'light' | 'dark'>('light');
	let selectedLimit = $state(5);
	let customWidth = $state('400');
	let customHeight = $state('300');
	let activeCodeTab = $state<'iframe' | 'json'>('iframe');

	const widgetTypes = [
		{
			id: 'currently-reading' as const,
			name: 'Currently Reading',
			description: 'Books you are currently reading',
			icon: Book,
			hasLimit: true
		},
		{
			id: 'recent-reads' as const,
			name: 'Recent Reads',
			description: 'Recently completed books with ratings',
			icon: CheckCircle,
			hasLimit: true
		},
		{
			id: 'stats' as const,
			name: 'Reading Stats',
			description: 'Overview of your reading statistics',
			icon: BarChart3,
			hasLimit: false
		},
		{
			id: 'goal' as const,
			name: 'Reading Goal',
			description: 'Progress towards your yearly goal',
			icon: Target,
			hasLimit: false
		}
	];

	// Generated URLs
	let embedUrl = $derived(
		`${data.baseUrl}/widgets/embed?type=${selectedType}&token=${token}&theme=${selectedTheme}${widgetTypes.find((t) => t.id === selectedType)?.hasLimit ? `&limit=${selectedLimit}` : ''}`
	);

	let apiUrl = $derived(
		`${data.baseUrl}/widgets/api/${selectedType}?token=${token}&theme=${selectedTheme}${widgetTypes.find((t) => t.id === selectedType)?.hasLimit ? `&limit=${selectedLimit}` : ''}`
	);

	let iframeCode = $derived(
		`<iframe src="${embedUrl}"\n  width="${customWidth}${customWidth.includes('%') ? '' : 'px'}"\n  height="${customHeight}${customHeight.includes('%') ? '' : 'px'}"\n  style="border: none; border-radius: 8px;">\n</iframe>`
	);

	async function copyToClipboard(text: string, type: string) {
		await navigator.clipboard.writeText(text);
		copied = type;
		setTimeout(() => (copied = null), 2000);
	}
</script>

<svelte:head>
	<title>Public Widgets - BookShelf Admin</title>
</svelte:head>

<div class="p-6 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Public Widgets</h1>
		<p style="color: var(--text-secondary);">
			Embed reading widgets on your blog or website
		</p>
	</div>

	<!-- Enable/Disable Toggle -->
	<div class="card p-4 mb-6">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-semibold" style="color: var(--text-primary);">Widget Access</h3>
				<p class="text-sm" style="color: var(--text-muted);">
					{enabled ? 'Public widgets are enabled' : 'Public widgets are disabled'}
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

	{#if enabled}
		<!-- Token Management -->
		<div class="card p-4 mb-6">
			<h3 class="font-semibold mb-3" style="color: var(--text-primary);">Security Token</h3>
			<p class="text-sm mb-4" style="color: var(--text-muted);">
				This token authenticates widget requests. Keep it private.
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

		<!-- Widget Type Selection -->
		<div class="card p-4 mb-6">
			<h3 class="font-semibold mb-4" style="color: var(--text-primary);">Widget Type</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each widgetTypes as wtype}
					<button
						type="button"
						class="p-4 rounded-lg text-left transition-all border-2"
						style="background-color: var(--bg-tertiary); border-color: {selectedType === wtype.id
							? 'var(--accent)'
							: 'transparent'};"
						onclick={() => (selectedType = wtype.id)}
					>
						<div class="flex items-center gap-3 mb-2">
							<wtype.icon
								class="w-5 h-5"
								style="color: {selectedType === wtype.id ? 'var(--accent)' : 'var(--text-muted)'};"
							/>
							<span class="font-medium" style="color: var(--text-primary);">{wtype.name}</span>
						</div>
						<p class="text-sm" style="color: var(--text-muted);">{wtype.description}</p>
					</button>
				{/each}
			</div>
		</div>

		<!-- Customization Options -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
			<!-- Options -->
			<div class="card p-4">
				<h3 class="font-semibold mb-4" style="color: var(--text-primary);">Options</h3>

				<div class="space-y-4">
					<!-- Theme -->
					<div>
						<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Theme
						</label>
						<div class="flex gap-2">
							<button
								type="button"
								class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
								style="background-color: {selectedTheme === 'light'
									? 'var(--accent)'
									: 'var(--bg-tertiary)'}; color: {selectedTheme === 'light' ? 'white' : 'var(--text-primary)'};"
								onclick={() => (selectedTheme = 'light')}
							>
								Light
							</button>
							<button
								type="button"
								class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
								style="background-color: {selectedTheme === 'dark'
									? 'var(--accent)'
									: 'var(--bg-tertiary)'}; color: {selectedTheme === 'dark' ? 'white' : 'var(--text-primary)'};"
								onclick={() => (selectedTheme = 'dark')}
							>
								Dark
							</button>
						</div>
					</div>

					<!-- Limit (for book widgets) -->
					{#if widgetTypes.find((t) => t.id === selectedType)?.hasLimit}
						<div>
							<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Number of Books
							</label>
							<select bind:value={selectedLimit} class="input">
								<option value={3}>3 books</option>
								<option value={5}>5 books</option>
								<option value={10}>10 books</option>
							</select>
						</div>
					{/if}

					<!-- Size -->
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Width
							</label>
							<input type="text" bind:value={customWidth} class="input" placeholder="400" />
						</div>
						<div>
							<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Height
							</label>
							<input type="text" bind:value={customHeight} class="input" placeholder="300" />
						</div>
					</div>
				</div>
			</div>

			<!-- Preview -->
			<div class="card p-4">
				<h3 class="font-semibold mb-4" style="color: var(--text-primary);">Preview</h3>
				<div
					class="rounded-lg overflow-hidden"
					style="background-color: var(--bg-tertiary); height: 300px;"
				>
					<iframe src={embedUrl} width="100%" height="100%" style="border: none;"></iframe>
				</div>
			</div>
		</div>

		<!-- Embed Code -->
		<div class="card p-4">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold" style="color: var(--text-primary);">Embed Code</h3>
				<div class="flex gap-2">
					<button
						type="button"
						class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
						style="background-color: {activeCodeTab === 'iframe'
							? 'var(--accent)'
							: 'var(--bg-tertiary)'}; color: {activeCodeTab === 'iframe' ? 'white' : 'var(--text-primary)'};"
						onclick={() => (activeCodeTab = 'iframe')}
					>
						<Code class="w-4 h-4 inline mr-1" />
						Iframe
					</button>
					<button
						type="button"
						class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
						style="background-color: {activeCodeTab === 'json'
							? 'var(--accent)'
							: 'var(--bg-tertiary)'}; color: {activeCodeTab === 'json' ? 'white' : 'var(--text-primary)'};"
						onclick={() => (activeCodeTab = 'json')}
					>
						JSON API
					</button>
				</div>
			</div>

			<div class="relative">
				<pre
					class="p-4 rounded-lg text-sm overflow-x-auto font-mono"
					style="background-color: var(--bg-tertiary); color: var(--text-primary);">{activeCodeTab === 'iframe' ? iframeCode : apiUrl}</pre>
				<button
					type="button"
					class="absolute top-2 right-2 p-2 rounded hover:bg-black/10"
					onclick={() => copyToClipboard(activeCodeTab === 'iframe' ? iframeCode : apiUrl, 'code')}
				>
					{#if copied === 'code'}
						<Check class="w-4 h-4 text-green-500" />
					{:else}
						<Copy class="w-4 h-4" style="color: var(--text-muted);" />
					{/if}
				</button>
			</div>
		</div>
	{:else}
		<div class="card p-8 text-center">
			<AlertTriangle class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
				Widgets Disabled
			</h3>
			<p style="color: var(--text-muted);">
				Enable widgets above to start embedding your reading data on external sites.
			</p>
		</div>
	{/if}
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
				This will invalidate all existing widget embeds. You'll need to update the embed code on all
				sites using your widgets.
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
