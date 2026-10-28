<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		LayoutGrid,
		Plus,
		Trash2,
		Copy,
		Check,
		Loader2,
		Clock,
		AlertCircle,
		AlertTriangle,
		RefreshCw,
		Pencil,
		X,
		Book,
		CheckCircle,
		BarChart3,
		Target,
		ListOrdered,
		CalendarClock
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	type WidgetType = 'currently-reading' | 'recent-reads' | 'stats' | 'goal' | 'next-up' | 'upcoming-releases';
	type WidgetTheme = 'light' | 'dark';

	interface Widget {
		id: number;
		name: string | null;
		type: WidgetType;
		theme: WidgetTheme;
		itemLimit: number;
		keyPrefix: string;
		createdAt: string | null;
		lastFetchedAt: string | null;
		disabled: boolean;
	}

	interface KeyResponse {
		widget: Widget;
		key: string;
		urls: { json: string; embed: string };
	}

	let { data } = $props();

	const widgetTypes = [
		{ id: 'currently-reading' as const, name: 'Currently Reading', description: 'Books you are reading right now', icon: Book, hasLimit: true },
		{ id: 'recent-reads' as const, name: 'Recent Reads', description: 'Books you finished most recently, with your ratings', icon: CheckCircle, hasLimit: true },
		{ id: 'next-up' as const, name: 'Next Up', description: 'Books on your Next Up list', icon: ListOrdered, hasLimit: true },
		{ id: 'upcoming-releases' as const, name: 'Upcoming Releases', description: 'Books in your library with a release date still to come', icon: CalendarClock, hasLimit: true },
		{ id: 'stats' as const, name: 'Reading Stats', description: 'Totals for your library: books, read, authors and more', icon: BarChart3, hasLimit: false },
		{ id: 'goal' as const, name: 'Reading Goal', description: "Your progress toward this year's reading goal", icon: Target, hasLimit: false }
	];

	function typeInfo(type: WidgetType) {
		return widgetTypes.find((t) => t.id === type);
	}

	// New widget form
	let newType = $state<WidgetType>('currently-reading');
	let newTheme = $state<WidgetTheme>('light');
	let newLimit = $state(5);
	let newName = $state('');
	let creating = $state(false);

	// "Copy now" panel, shown once after create or rotate
	let revealed = $state<KeyResponse | null>(null);
	let snippetWidth = $state('400');
	let snippetHeight = $state('300');
	let copied = $state<string | null>(null);

	// Inline edit
	let editingId = $state<number | null>(null);
	let editName = $state('');
	let editTheme = $state<WidgetTheme>('light');
	let editLimit = $state(5);
	let saving = $state(false);

	let busyId = $state<number | null>(null);

	let atMax = $derived(data.widgets.length >= data.maxWidgets);

	let iframeCode = $derived(
		revealed
			? `<iframe src="${revealed.urls.embed}"\n  width="${snippetWidth}${snippetWidth.includes('%') ? '' : 'px'}"\n  height="${snippetHeight}${snippetHeight.includes('%') ? '' : 'px'}"\n  style="border: none; border-radius: 8px;">\n</iframe>`
			: ''
	);

	function clamp(n: number): number {
		if (!Number.isFinite(n) || n === 0) return 5;
		return Math.max(1, Math.min(Math.trunc(n), 20));
	}

	function formatRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'never';
		const date = new Date(dateStr);
		const diffMs = Date.now() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	async function errorMessage(res: Response, fallback: string): Promise<string> {
		try {
			const body = await res.json();
			return body.message || fallback;
		} catch {
			return fallback;
		}
	}

	async function createWidget() {
		creating = true;
		try {
			const body: Record<string, unknown> = { type: newType, theme: newTheme };
			if (typeInfo(newType)?.hasLimit) body.itemLimit = clamp(newLimit);
			if (newName.trim()) body.name = newName.trim();

			const res = await fetch('/api/widgets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				revealed = await res.json();
				newName = '';
				toasts.success('Widget created');
				await invalidateAll();
			} else {
				toasts.error(await errorMessage(res, 'Failed to create widget'));
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			creating = false;
		}
	}

	function startEdit(widget: Widget) {
		editingId = widget.id;
		editName = widget.name ?? '';
		editTheme = widget.theme;
		editLimit = widget.itemLimit;
	}

	async function saveEdit(widget: Widget) {
		saving = true;
		try {
			const body: Record<string, unknown> = { name: editName.trim() || null, theme: editTheme };
			if (typeInfo(widget.type)?.hasLimit) body.itemLimit = clamp(editLimit);

			const res = await fetch(`/api/widgets/${widget.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				editingId = null;
				toasts.success('Widget updated');
				await invalidateAll();
			} else {
				toasts.error(await errorMessage(res, 'Failed to update widget'));
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			saving = false;
		}
	}

	async function rotateWidget(widget: Widget) {
		if (!confirm('Rotate this widget\'s key? The old URL stops working and you will need to update your embed code.')) {
			return;
		}

		busyId = widget.id;
		try {
			const res = await fetch(`/api/widgets/${widget.id}/rotate`, { method: 'POST' });
			if (res.ok) {
				revealed = await res.json();
				toasts.success('New widget URL created');
				await invalidateAll();
			} else {
				toasts.error(await errorMessage(res, 'Failed to rotate key'));
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			busyId = null;
		}
	}

	async function revokeWidget(widget: Widget) {
		if (!confirm('Revoke this widget? Its URL stops working immediately and this cannot be undone.')) {
			return;
		}

		busyId = widget.id;
		try {
			const res = await fetch(`/api/widgets/${widget.id}`, { method: 'DELETE' });
			if (res.ok) {
				if (revealed?.widget.id === widget.id) revealed = null;
				toasts.success('Widget revoked');
				await invalidateAll();
			} else {
				toasts.error(await errorMessage(res, 'Failed to revoke widget'));
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			busyId = null;
		}
	}

	async function copyToClipboard(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => (copied = null), 2000);
		} catch {
			toasts.error('Failed to copy');
		}
	}
</script>

<svelte:head>
	<title>Widgets | My Account</title>
</svelte:head>

<div class="container mx-auto px-4 py-6 max-w-4xl">
	<!-- Header -->
	<div class="flex items-center gap-3 mb-6">
		<LayoutGrid class="w-6 h-6" style="color: var(--accent);" />
		<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Widgets</h1>
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
			style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
		>
			API Tokens
		</a>
		<a
			href="/account/widgets"
			class="px-4 py-2 rounded-lg font-medium"
			style="background-color: var(--accent); color: white;"
		>
			Widgets
		</a>
	</div>

	{#if !data.widgetsEnabled}
		<div
			class="p-4 rounded-lg mb-6 flex gap-3"
			style="background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b;"
		>
			<AlertTriangle class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: #f59e0b;" />
			<p class="text-sm" style="color: var(--text-secondary);">
				Widgets are turned off by your administrator. Your widget URLs show 'Not found' until they
				are turned on.
			</p>
		</div>
	{/if}

	<!-- Copy now panel -->
	{#if revealed}
		<div class="card p-4 mb-6 space-y-4">
			<div class="flex items-start justify-between gap-3">
				<div class="p-3 rounded-lg flex items-start gap-3 flex-1" style="background: rgba(239, 68, 68, 0.1);">
					<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: #ef4444;" />
					<div class="text-sm" style="color: #ef4444;">
						<p class="font-medium">Copy now!</p>
						<p>Anyone with this URL sees this widget. It won't be shown again.</p>
					</div>
				</div>
				<button
					type="button"
					class="p-2 rounded-lg hover:bg-black/10"
					title="Close"
					onclick={() => (revealed = null)}
				>
					<X class="w-5 h-5" style="color: var(--text-muted);" />
				</button>
			</div>

			<div>
				<label for="widget-json-url" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
					JSON URL
				</label>
				<div class="relative">
					<input
						id="widget-json-url"
						type="text"
						class="form-input w-full pr-10 font-mono text-xs"
						value={revealed.urls.json}
						readonly
					/>
					<button
						type="button"
						class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-black/10"
						title="Copy URL"
						onclick={() => copyToClipboard(revealed?.urls.json ?? '', 'json')}
					>
						{#if copied === 'json'}
							<Check class="w-4 h-4" style="color: #22c55e;" />
						{:else}
							<Copy class="w-4 h-4" style="color: var(--text-muted);" />
						{/if}
					</button>
				</div>
			</div>

			<div>
				<div class="flex items-end justify-between gap-4 mb-2">
					<span class="block text-sm font-medium" style="color: var(--text-secondary);">Embed code</span>
					<div class="flex gap-2">
						<label class="text-xs flex items-center gap-1" style="color: var(--text-muted);">
							Width
							<input type="text" class="form-input w-20 text-xs" bind:value={snippetWidth} />
						</label>
						<label class="text-xs flex items-center gap-1" style="color: var(--text-muted);">
							Height
							<input type="text" class="form-input w-20 text-xs" bind:value={snippetHeight} />
						</label>
					</div>
				</div>
				<div class="relative">
					<pre
						class="p-4 rounded-lg text-xs overflow-x-auto font-mono"
						style="background-color: var(--bg-tertiary); color: var(--text-primary);">{iframeCode}</pre>
					<button
						type="button"
						class="absolute top-2 right-2 p-2 rounded hover:bg-black/10"
						title="Copy embed code"
						onclick={() => copyToClipboard(iframeCode, 'iframe')}
					>
						{#if copied === 'iframe'}
							<Check class="w-4 h-4" style="color: #22c55e;" />
						{:else}
							<Copy class="w-4 h-4" style="color: var(--text-muted);" />
						{/if}
					</button>
				</div>
			</div>

			<div>
				<span class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Preview</span>
				<div class="rounded-lg overflow-hidden" style="background-color: var(--bg-tertiary); height: 300px;">
					<iframe
						src={revealed.urls.embed}
						title="Widget preview"
						width="100%"
						height="100%"
						style="border: none;"
						referrerpolicy="no-referrer"
					></iframe>
				</div>
			</div>
		</div>
	{/if}

	<!-- New widget -->
	{#if data.canCreate}
		<div class="card p-4 mb-6">
			<h2 class="font-semibold mb-4" style="color: var(--text-primary);">New widget</h2>

			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
				{#each widgetTypes as wtype}
					<button
						type="button"
						class="p-3 rounded-lg text-left transition-all border-2"
						style="background-color: var(--bg-tertiary); border-color: {newType === wtype.id
							? 'var(--accent)'
							: 'transparent'};"
						onclick={() => (newType = wtype.id)}
					>
						<div class="flex items-center gap-2 mb-1">
							<wtype.icon
								class="w-4 h-4"
								style="color: {newType === wtype.id ? 'var(--accent)' : 'var(--text-muted)'};"
							/>
							<span class="font-medium text-sm" style="color: var(--text-primary);">{wtype.name}</span>
						</div>
						<p class="text-xs" style="color: var(--text-muted);">{wtype.description}</p>
					</button>
				{/each}
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
				<div>
					<span class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">Theme</span>
					<div class="flex gap-2">
						{#each ['light', 'dark'] as const as theme}
							<button
								type="button"
								class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
								style="background-color: {newTheme === theme ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {newTheme === theme ? 'white' : 'var(--text-primary)'};"
								onclick={() => (newTheme = theme)}
							>
								{theme === 'light' ? 'Light' : 'Dark'}
							</button>
						{/each}
					</div>
				</div>

				{#if typeInfo(newType)?.hasLimit}
					<div>
						<label for="new-widget-limit" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Number of books (1–20)
						</label>
						<input id="new-widget-limit" type="number" min="1" max="20" class="form-input w-full" bind:value={newLimit} />
					</div>
				{/if}

				<div>
					<label for="new-widget-name" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Name (optional)
					</label>
					<input
						id="new-widget-name"
						type="text"
						class="form-input w-full"
						placeholder="e.g., Blog sidebar"
						maxlength="100"
						bind:value={newName}
					/>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3">
				{#if atMax}
					<span class="text-xs" style="color: var(--text-muted);">
						You have reached the limit of {data.maxWidgets} widgets
					</span>
				{/if}
				<button
					type="button"
					class="btn-primary flex items-center gap-2"
					onclick={createWidget}
					disabled={creating || atMax}
				>
					{#if creating}
						<Loader2 class="w-4 h-4 animate-spin" />
					{:else}
						<Plus class="w-4 h-4" />
					{/if}
					Create
				</button>
			</div>
		</div>
	{/if}

	<!-- Your widgets -->
	<div class="card">
		<h2 class="font-semibold px-4 pt-4" style="color: var(--text-primary);">Your widgets</h2>
		{#if data.widgets.length === 0}
			<div class="text-center py-12">
				<LayoutGrid class="w-12 h-12 mx-auto mb-3 opacity-30" style="color: var(--text-muted);" />
				<p class="font-medium" style="color: var(--text-primary);">No widgets</p>
				<p class="text-sm mt-1" style="color: var(--text-muted);">
					Create a widget to show your reading on a blog or website
				</p>
			</div>
		{:else}
			<div class="divide-y" style="border-color: var(--border-color);">
				{#each data.widgets as widget (widget.id)}
					{@const info = typeInfo(widget.type)}
					<div class="p-4">
						<div class="flex items-center justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<p class="font-medium truncate" style="color: var(--text-primary);">
										{widget.name ?? info?.name ?? widget.type}
									</p>
									{#if widget.disabled}
										<span
											class="text-xs px-2 py-0.5 rounded-full"
											style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"
										>
											Disabled by an administrator
										</span>
									{/if}
								</div>
								<div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs" style="color: var(--text-muted);">
									<span>{info?.name ?? widget.type}</span>
									<span>{widget.theme === 'dark' ? 'Dark' : 'Light'}</span>
									{#if info?.hasLimit}
										<span>{widget.itemLimit} books</span>
									{/if}
									<span class="font-mono">{widget.keyPrefix}…</span>
									<span class="flex items-center gap-1">
										<Clock class="w-3 h-3" />
										Created {formatRelativeTime(widget.createdAt)}
									</span>
									<span>Last fetched {formatRelativeTime(widget.lastFetchedAt)}</span>
								</div>
							</div>
							<div class="flex items-center gap-1">
								<button
									type="button"
									class="p-2 rounded-lg hover:bg-black/10 transition-colors disabled:opacity-40"
									title="Edit"
									onclick={() => (editingId === widget.id ? (editingId = null) : startEdit(widget))}
									disabled={widget.disabled}
								>
									<Pencil class="w-4 h-4" style="color: var(--text-muted);" />
								</button>
								<button
									type="button"
									class="p-2 rounded-lg hover:bg-black/10 transition-colors disabled:opacity-40"
									title="Rotate key"
									onclick={() => rotateWidget(widget)}
									disabled={widget.disabled || busyId === widget.id}
								>
									<RefreshCw class="w-4 h-4" style="color: var(--text-muted);" />
								</button>
								<button
									type="button"
									class="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
									title="Revoke"
									onclick={() => revokeWidget(widget)}
									disabled={busyId === widget.id}
								>
									{#if busyId === widget.id}
										<Loader2 class="w-4 h-4 animate-spin" style="color: var(--text-muted);" />
									{:else}
										<Trash2 class="w-4 h-4 text-red-400" />
									{/if}
								</button>
							</div>
						</div>

						{#if editingId === widget.id}
							<div class="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
								<div>
									<label for="edit-name-{widget.id}" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Name</label>
									<input id="edit-name-{widget.id}" type="text" class="form-input w-full" maxlength="100" bind:value={editName} />
								</div>
								<div>
									<label for="edit-theme-{widget.id}" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Theme</label>
									<select id="edit-theme-{widget.id}" class="form-input w-full" bind:value={editTheme}>
										<option value="light">Light</option>
										<option value="dark">Dark</option>
									</select>
								</div>
								{#if info?.hasLimit}
									<div>
										<label for="edit-limit-{widget.id}" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">Books (1–20)</label>
										<input id="edit-limit-{widget.id}" type="number" min="1" max="20" class="form-input w-full" bind:value={editLimit} />
									</div>
								{:else}
									<div></div>
								{/if}
								<div class="flex gap-2 justify-end">
									<button type="button" class="btn-ghost" onclick={() => (editingId = null)}>Cancel</button>
									<button
										type="button"
										class="btn-primary flex items-center gap-2"
										onclick={() => saveEdit(widget)}
										disabled={saving}
									>
										{#if saving}
											<Loader2 class="w-4 h-4 animate-spin" />
										{/if}
										Save
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

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
