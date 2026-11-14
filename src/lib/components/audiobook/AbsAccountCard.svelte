<script lang="ts">
	import { Headphones, Loader2, Unlink, KeyRound, AlertCircle, Info } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	interface Connection {
		connected: boolean;
		absUsername: string | null;
		keySource: 'own' | 'site' | null;
		keyFingerprint: string | null;
		syncListening: boolean;
		pending: boolean;
		connectedAt: string | null;
		connectedByOther: boolean;
		lastSyncAt: string | null;
		lastError: string | null;
		lastErrorAt: string | null;
	}
	interface AbsCardData {
		available: boolean;
		baseUrl: string | null;
		secretAvailable: boolean;
		connection: Connection;
		cadence: { scheduled: boolean; intervalMinutes: number };
		unplaced: number;
	}

	let { initial }: { initial: AbsCardData } = $props();

	let card = $state<AbsCardData>(structuredClone(initial));
	let apiKey = $state('');
	let replacing = $state(false);
	let busy = $state<'connect' | 'toggle' | 'disconnect' | 'import' | null>(null);
	let message = $state<string | null>(null);

	const conn = $derived(card.connection);

	const ERROR_TEXT: Record<string, string> = {
		key_rejected: 'Audiobookshelf no longer accepts this key. Replace it to keep syncing.',
		identity_changed: 'This key now belongs to a different Audiobookshelf account, so nothing syncs. Replace it to keep syncing.',
		identity_conflict: 'This Audiobookshelf account is connected to another BookShelf user, so nothing syncs.',
		decrypt_failed: "Your saved key can't be read any more (the server's secret changed). Replace it to keep syncing."
	};

	function every(minutes: number): string {
		if (minutes % 1440 === 0) return minutes === 1440 ? 'day' : `${minutes / 1440} days`;
		if (minutes % 60 === 0) return minutes === 60 ? 'hour' : `${minutes / 60} hours`;
		return `${minutes} minutes`;
	}

	async function reload() {
		const res = await fetch('/api/account/abs');
		if (res.ok) card = await res.json();
	}

	async function connect() {
		busy = 'connect';
		message = null;
		try {
			const res = await fetch('/api/account/abs', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey })
			});
			const body = await res.json();
			if (!res.ok) {
				message = body.message ?? 'Could not connect';
				return;
			}
			apiKey = '';
			replacing = false;
			toasts.success(`Connected as ${body.connection.absUsername ?? 'your Audiobookshelf account'}`);
			await reload();
		} catch {
			message = 'Could not connect';
		} finally {
			busy = null;
		}
	}

	async function toggleSync() {
		busy = 'toggle';
		try {
			const res = await fetch('/api/account/abs', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ syncListening: !conn.syncListening })
			});
			if (res.ok) await reload();
			else toasts.error((await res.json()).message ?? 'Could not change the setting');
		} finally {
			busy = null;
		}
	}

	async function importHistory() {
		busy = 'import';
		try {
			const preview = await fetch('/api/account/abs/import-history');
			const counts = await preview.json();
			if (!preview.ok) {
				toasts.error(counts.message ?? 'Could not check your listening history');
				return;
			}
			if (counts.added === 0 && counts.changed === 0) {
				toasts.success('Nothing to add: your library already matches what you listened to');
				return;
			}
			const parts = [counts.added > 0 ? `add ${counts.added} ${counts.added === 1 ? 'book' : 'books'} to your library` : '', counts.changed > 0 ? `update the status of ${counts.changed}` : ''].filter(Boolean);
			if (!confirm(`This will ${parts.join(' and ')} from what you listened to before connecting. Continue?`)) return;
			const res = await fetch('/api/account/abs/import-history', { method: 'POST' });
			const body = await res.json();
			if (!res.ok) toasts.error(body.message ?? 'Import failed');
			else toasts.success(`Added ${body.added}, updated ${body.changed}`);
		} finally {
			busy = null;
		}
	}

	async function disconnect() {
		if (!confirm('Disconnect Audiobookshelf? Your books and statuses stay as they are; only the saved key is removed.')) return;
		busy = 'disconnect';
		try {
			const res = await fetch('/api/account/abs', { method: 'DELETE' });
			if (res.ok) {
				toasts.success('Audiobookshelf disconnected');
				await reload();
			} else {
				toasts.error((await res.json()).message ?? 'Could not disconnect');
			}
		} finally {
			busy = null;
		}
	}
</script>

<section class="card p-6" id="audiobookshelf">
	<div class="flex items-center gap-2 mb-4">
		<Headphones class="w-5 h-5" style="color: var(--accent);" />
		<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Audiobookshelf</h2>
	</div>

	<p class="text-sm mb-4" style="color: var(--text-muted);">
		Connect your own Audiobookshelf account at <span class="font-mono" style="color: var(--text-secondary);">{card.baseUrl}</span>
		so BookShelf can follow what you listen to. Playing books still happens in Audiobookshelf.
	</p>

	{#if !card.secretAvailable}
		<div class="p-3 rounded-lg mb-4 flex gap-3" style="background-color: var(--bg-tertiary); border-left: 3px solid #f59e0b;">
			<AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" style="color: #f59e0b;" />
			<p class="text-sm" style="color: var(--text-secondary);">This server can't store keys safely yet. Ask your administrator to set SESSION_SECRET.</p>
		</div>
	{/if}

	{#if conn.connected}
		<div class="space-y-4">
			<div class="p-4 rounded-lg text-sm space-y-1" style="background-color: var(--bg-tertiary);">
				{#if conn.pending}
					<p style="color: var(--text-primary);">Connected with the server's own Audiobookshelf key. The account is confirmed on the next sync.</p>
				{:else}
					<p style="color: var(--text-primary);">Connected as <strong>{conn.absUsername ?? 'unknown'}</strong></p>
				{/if}
				{#if conn.keySource === 'site'}
					<p style="color: var(--text-muted);">Uses the server's Audiobookshelf key (you're the sync owner).</p>
				{:else if conn.keyFingerprint}
					<p style="color: var(--text-muted);">Key fingerprint <span class="font-mono">{conn.keyFingerprint.slice(0, 8)}</span></p>
				{/if}
				{#if conn.connectedByOther}
					<p style="color: var(--text-muted);">An administrator connected this account for you. If that isn't your Audiobookshelf account, disconnect it.</p>
				{/if}
				{#if conn.lastSyncAt}<p style="color: var(--text-muted);">Last synced {new Date(conn.lastSyncAt).toLocaleString()}</p>{/if}
			</div>

			{#if conn.lastError}
				<div class="p-3 rounded-lg flex gap-3" style="background-color: var(--bg-tertiary); border-left: 3px solid #ef4444;">
					<AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" style="color: #ef4444;" />
					<p class="text-sm" style="color: var(--text-secondary);">{ERROR_TEXT[conn.lastError] ?? `The last sync couldn't reach Audiobookshelf: ${conn.lastError}`}</p>
				</div>
			{/if}

			<label class="flex items-center justify-between p-3 rounded-lg cursor-pointer" style="background-color: var(--bg-tertiary);">
				<div class="pr-4">
					<p class="font-medium" style="color: var(--text-primary);">Sync my listening</p>
					<p class="text-sm" style="color: var(--text-muted);">
						Books you listen to for 5 minutes or more move to Currently Reading, and finished ones to Done. A listened book from the shared
						library is added to your library. Only listening after you connected counts, and a status never moves backwards from Done.
					</p>
				</div>
				<input type="checkbox" class="toggle" checked={conn.syncListening} disabled={busy !== null} onchange={toggleSync} />
			</label>

			<div class="p-3 rounded-lg flex gap-3" style="background-color: var(--bg-tertiary); border-left: 3px solid var(--accent);">
				<Info class="w-4 h-4 flex-shrink-0 mt-0.5" style="color: var(--accent);" />
				<div class="text-sm space-y-1" style="color: var(--text-muted);">
					{#if card.cadence.scheduled}
						<p>Your listening syncs with the library sync, every {every(card.cadence.intervalMinutes)}.</p>
					{:else}
						<p>The library sync isn't scheduled right now, so nothing syncs until an administrator turns it on.</p>
					{/if}
					{#if card.unplaced > 0}
						<p>{card.unplaced} {card.unplaced === 1 ? 'item' : 'items'} you listened to {card.unplaced === 1 ? "isn't" : "aren't"} in the shared library yet, so {card.unplaced === 1 ? 'it was' : 'they were'} left alone.</p>
					{/if}
				</div>
			</div>

			{#if !conn.pending && !conn.lastError}
				<div>
					<button type="button" class="btn-secondary flex items-center gap-2" disabled={busy !== null} onclick={importHistory}>
						{#if busy === 'import'}<Loader2 class="w-4 h-4 animate-spin" />{/if} Add what I've already listened to
					</button>
					<p class="text-xs mt-1" style="color: var(--text-muted);">Only listening after you connected syncs on its own. This brings in the rest once, after showing you how many books it touches.</p>
				</div>
			{/if}

			{#if replacing}
				<div class="flex gap-2">
					<input type="password" class="input flex-1" placeholder="New Audiobookshelf API key" bind:value={apiKey} autocomplete="off" />
					<button type="button" class="btn-accent flex items-center gap-2" disabled={!apiKey.trim() || busy !== null || !card.secretAvailable} onclick={connect}>
						{#if busy === 'connect'}<Loader2 class="w-4 h-4 animate-spin" />{/if} Test & replace
					</button>
					<button type="button" class="btn-ghost" onclick={() => { replacing = false; apiKey = ''; message = null; }}>Cancel</button>
				</div>
			{/if}
			{#if message}<p class="text-sm" style="color: #ef4444;">{message}</p>{/if}

			<div class="flex gap-2 flex-wrap">
				{#if !replacing}
					<button type="button" class="btn-secondary flex items-center gap-2" disabled={busy !== null || !card.secretAvailable} onclick={() => (replacing = true)}>
						<KeyRound class="w-4 h-4" /> {conn.keySource === 'site' ? 'Use my own key' : 'Replace key'}
					</button>
				{/if}
				<button type="button" class="btn-ghost flex items-center gap-2" style="color: #ef4444;" disabled={busy !== null} onclick={disconnect}>
					{#if busy === 'disconnect'}<Loader2 class="w-4 h-4 animate-spin" />{:else}<Unlink class="w-4 h-4" />{/if} Disconnect
				</button>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			<p class="text-sm" style="color: var(--text-secondary);">
				In Audiobookshelf, create an API key for your own account (Settings → API Keys), then paste it here. Syncing stays off until you turn it on.
			</p>
			<div class="flex gap-2">
				<input type="password" class="input flex-1" placeholder="Audiobookshelf API key" bind:value={apiKey} autocomplete="off" disabled={!card.secretAvailable} />
				<button type="button" class="btn-accent flex items-center gap-2" disabled={!apiKey.trim() || busy !== null || !card.secretAvailable} onclick={connect}>
					{#if busy === 'connect'}<Loader2 class="w-4 h-4 animate-spin" />{/if} Test & connect
				</button>
			</div>
			{#if message}<p class="text-sm" style="color: #ef4444;">{message}</p>{/if}
		</div>
	{/if}
</section>
