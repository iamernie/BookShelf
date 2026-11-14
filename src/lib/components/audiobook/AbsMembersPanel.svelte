<script lang="ts">
	import { Loader2, KeyRound, Unlink, RefreshCw } from 'lucide-svelte';
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
	interface Member {
		userId: number;
		username: string;
		role: string | null;
		connection: Connection;
		connectedByName: string | null;
	}

	let members = $state<Member[] | null>(null);
	let cadence = $state<{ scheduled: boolean; intervalMinutes: number } | null>(null);
	let secretAvailable = $state(true);
	let assigningId = $state<number | null>(null);
	let assignKey = $state('');
	let busyId = $state<number | null>(null);

	async function load() {
		const res = await fetch('/api/admin/abs/members');
		if (!res.ok) return;
		const body = await res.json();
		members = body.members;
		cadence = body.cadence;
		secretAvailable = body.secretAvailable;
	}

	$effect(() => {
		load();
	});

	async function act(userId: number, path: string, method: string, body?: unknown, done?: string) {
		busyId = userId;
		try {
			const res = await fetch(`/api/admin/abs/members/${userId}${path}`, {
				method,
				headers: body ? { 'Content-Type': 'application/json' } : undefined,
				body: body ? JSON.stringify(body) : undefined
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok) {
				toasts.error(result.message ?? 'Action failed');
				return false;
			}
			if (done) toasts.success(done);
			await load();
			return true;
		} finally {
			busyId = null;
		}
	}

	async function assign(m: Member) {
		if (await act(m.userId, '', 'PUT', { apiKey: assignKey }, `Key assigned to ${m.username}. They turn syncing on themselves.`)) {
			assignKey = '';
			assigningId = null;
		}
	}

	const errorLabel: Record<string, string> = {
		key_rejected: 'key rejected',
		identity_changed: 'key now belongs to another ABS account',
		identity_conflict: 'ABS account already connected to someone else',
		decrypt_failed: "stored key can't be read"
	};
</script>

<div class="space-y-3">
	<div class="card p-4 text-sm space-y-1" style="color: var(--text-secondary);">
		<p>
			Each person connects their own Audiobookshelf account on their Account page, and decides themselves whether their listening syncs.
			If someone won't make a key, create one in Audiobookshelf that acts as their account (if your Audiobookshelf version allows it) and
			assign it here; otherwise ask them to paste their own. Assigning never turns syncing on.
		</p>
		{#if cadence}
			<p style="color: var(--text-muted);">
				{cadence.scheduled ? `Listening syncs with each scheduled library sync (every ${cadence.intervalMinutes} minutes).` : 'The library sync is not scheduled, so no listening syncs right now.'}
			</p>
		{/if}
		{#if !secretAvailable}
			<p style="color: #ef4444;">SESSION_SECRET is unset, too short or a placeholder: keys can't be stored until it is set.</p>
		{/if}
	</div>

	<div class="card overflow-hidden">
		{#if members === null}
			<div class="p-4"><Loader2 class="w-4 h-4 animate-spin" /></div>
		{:else}
			<div class="divide-y" style="border-color: var(--border-color);">
				{#each members as m (m.userId)}
					{@const c = m.connection}
					<div class="px-4 py-3 text-sm">
						<div class="flex items-start gap-3 flex-wrap">
							<div class="flex-1 min-w-0">
								<p class="font-medium" style="color: var(--text-primary);">{m.username} <span class="text-xs" style="color: var(--text-muted);">{m.role}</span></p>
								{#if c.connected}
									<p style="color: var(--text-secondary);">
										{c.pending ? 'ABS account confirmed on next sync' : `ABS: ${c.absUsername ?? '?'}`}
										· {c.keySource === 'site' ? 'uses the site key' : 'own key'}
										{#if m.connectedByName} · connected by {m.connectedByName}{/if}
										· sync {c.syncListening ? 'on' : 'off'}
										{#if c.lastSyncAt} · last sync {new Date(c.lastSyncAt).toLocaleString()}{/if}
									</p>
									{#if c.lastError}<p style="color: #ef4444;">{errorLabel[c.lastError] ?? c.lastError}</p>{/if}
								{:else}
									<p style="color: var(--text-muted);">Not connected</p>
								{/if}
							</div>
							<div class="flex gap-2">
								{#if c.keySource === 'site' && (c.pending || c.lastError === 'identity_changed' || c.lastError === 'identity_conflict')}
									<button type="button" class="btn-secondary flex items-center gap-1" disabled={busyId !== null}
										title="Bind to whoever the site key belongs to now. Resets what counts as past listening; syncing turns off unless it's your own row."
										onclick={() => act(m.userId, '/rebind', 'POST', undefined, 'Re-bound to the current site key')}>
										<RefreshCw class="w-4 h-4" /> Re-bind
									</button>
								{/if}
								<button type="button" class="btn-secondary flex items-center gap-1" disabled={busyId !== null || !secretAvailable}
									onclick={() => { assigningId = assigningId === m.userId ? null : m.userId; assignKey = ''; }}>
									<KeyRound class="w-4 h-4" /> Assign key
								</button>
								{#if c.connected}
									<button type="button" class="btn-ghost flex items-center gap-1" style="color: #ef4444;" disabled={busyId !== null}
										onclick={() => confirm(`Disconnect ${m.username} from Audiobookshelf? Their books and statuses stay as they are.`) && act(m.userId, '', 'DELETE', undefined, 'Disconnected')}>
										<Unlink class="w-4 h-4" /> Disconnect
									</button>
								{/if}
							</div>
						</div>
						{#if assigningId === m.userId}
							<div class="flex gap-2 mt-2">
								<input type="password" class="input flex-1" placeholder="Audiobookshelf API key for {m.username}" bind:value={assignKey} autocomplete="off" />
								<button type="button" class="btn-accent flex items-center gap-1" disabled={!assignKey.trim() || busyId !== null} onclick={() => assign(m)}>
									{#if busyId === m.userId}<Loader2 class="w-4 h-4 animate-spin" />{/if} Test & assign
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
