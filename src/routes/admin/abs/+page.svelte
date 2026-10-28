<script lang="ts">
	import { RefreshCw, Loader2, AlertTriangle, ChevronDown, ChevronRight, Headphones } from 'lucide-svelte';
	import AbsRunSummary from '$lib/components/audiobook/AbsRunSummary.svelte';
	import AbsAttentionRow from '$lib/components/audiobook/AbsAttentionRow.svelte';
	import { toasts } from '$lib/stores/toast';

	let { data } = $props();

	type Overview = typeof data.overview;
	type Run = (typeof data.runs)[number];
	type AttentionItem = (typeof data.attention)[number];
	interface RunDetail {
		pass: string;
		action: string;
		absItemId?: string;
		title?: string;
		bookId?: number;
		tier?: string;
		reason?: string;
		fields?: string[];
	}

	let overview = $state<Overview>(data.overview);
	let runs = $state<Run[]>(data.runs);
	let attention = $state<AttentionItem[]>(data.attention);
	let activeTab = $state<'runs' | 'attention'>(data.attention.length > 0 ? 'attention' : 'runs');
	let attentionFilter = $state<'open' | 'ignored' | 'resolved'>('open');
	let starting = $state(false);
	let busyAttentionId = $state<number | null>(null);
	let expandedRunId = $state<number | null>(null);
	let runDetails = $state<Record<number, RunDetail[]>>({});

	const running = $derived(!!overview.running || starting);

	async function refresh() {
		try {
			const [o, r] = await Promise.all([fetch('/api/admin/abs/sync'), fetch('/api/admin/abs/runs?limit=25')]);
			if (o.ok) overview = await o.json();
			if (r.ok) runs = (await r.json()).runs;
		} catch {
			// Keep the last known state
		}
	}

	async function loadAttention() {
		const res = await fetch(`/api/admin/abs/attention?status=${attentionFilter}`);
		if (res.ok) attention = (await res.json()).items;
	}

	// Poll every 5 seconds while a run is in flight; reload the queue when it ends
	$effect(() => {
		if (!overview.running) return;
		const timer = setInterval(async () => {
			await refresh();
			if (!overview.running) await loadAttention();
		}, 5000);
		return () => clearInterval(timer);
	});

	async function startRun(mode: 'apply' | 'preview') {
		starting = true;
		try {
			const res = await fetch('/api/admin/abs/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode })
			});
			const body = await res.json();
			if (res.status === 202) toasts.success(`${mode === 'preview' ? 'Preview' : 'Sync'} #${body.runId} started`);
			else toasts.error(body.message || 'Sync failed to start');
		} catch {
			toasts.error('Failed to start sync');
		} finally {
			starting = false;
			await refresh();
		}
	}

	async function toggleRun(id: number) {
		if (expandedRunId === id) {
			expandedRunId = null;
			return;
		}
		expandedRunId = id;
		if (!runDetails[id]) {
			const res = await fetch(`/api/admin/abs/runs/${id}`);
			if (res.ok) runDetails = { ...runDetails, [id]: (await res.json()).details ?? [] };
		}
	}

	async function attentionAction(id: number, body: Record<string, unknown>) {
		busyAttentionId = id;
		try {
			const res = await fetch(`/api/admin/abs/attention/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const result = await res.json();
			if (!res.ok) {
				toasts.error(result.message || 'Action failed');
				return;
			}
			const verb: Record<string, string> = { link: 'Linked', create: 'Created', keep: 'Kept', ignore: 'Ignored', reopen: 'Reopened' };
			toasts.success(`${verb[body.action as string] ?? 'Done'}${result.book ? `: ${result.book.title}` : ''}`);
			attention = attention.filter((a) => a.id !== id);
			await refresh();
		} catch {
			toasts.error('Action failed');
		} finally {
			busyAttentionId = null;
		}
	}

	function formatTime(iso: string | null): string {
		return iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
	}

	function formatDuration(ms: number | null): string {
		if (ms === null) return '';
		if (ms < 1000) return `${ms} ms`;
		const s = ms / 1000;
		return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
	}

	const statusColor: Record<string, string> = {
		running: 'var(--accent)',
		succeeded: '#22c55e',
		partial: '#f59e0b',
		failed: '#ef4444',
		abandoned: 'var(--text-muted)'
	};

	const actionLabel = (action: string, preview: boolean): string => {
		const labels: Record<string, [string, string]> = {
			linked: ['Linked', 'Would link'],
			created: ['Created', 'Would create'],
			pushed: ['Pushed to Audiobookshelf', 'Would push'],
			queued: ['Needs attention', 'Needs attention'],
			skipped: ['Skipped', 'Skipped'],
			stale: ['Stale link', 'Would flag stale'],
			cleared: ['Stale flag cleared', 'Would clear stale flag'],
			status: ['Status changed', 'Would change status'],
			duplicate_link: ['Duplicate link', 'Duplicate link'],
			failed: ['Failed', 'Failed']
		};
		return labels[action]?.[preview ? 1 : 0] ?? action;
	};

	function groupDetails(details: RunDetail[]): [string, RunDetail[]][] {
		const groups = new Map<string, RunDetail[]>();
		for (const d of details) groups.set(d.action, [...(groups.get(d.action) ?? []), d]);
		return [...groups.entries()];
	}

	const nextRunLabel = $derived.by(() => {
		if (!overview.enabled) return 'Sync is off';
		if (overview.schedule.nextRunAt === null) return 'Schedule off (Sync Now only)';
		const next = new Date(overview.schedule.nextRunAt);
		return next.getTime() <= Date.now() ? 'Next run due now' : `Next run ≈ ${next.toLocaleString()}`;
	});
</script>

<svelte:head>
	<title>Audiobookshelf Sync - BookShelf Admin</title>
</svelte:head>

<div class="p-6 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-start justify-between gap-4 flex-wrap">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
				<Headphones class="w-6 h-6" /> Audiobookshelf Sync
			</h1>
			<p style="color: var(--text-secondary);">
				{#if overview.running}
					<span class="inline-flex items-center gap-1.5" style="color: var(--accent);">
						<Loader2 class="w-4 h-4 animate-spin" /> Running #{overview.running.id} ({overview.running.mode})
					</span>
				{:else}
					Idle
				{/if}
				· {nextRunLabel}
				{#if overview.owner} · books owned by {overview.owner.username}{/if}
				· {overview.linkedCount} linked · {overview.unlinkedAudioCount} unlinked audio
				· <a href="/admin/settings" class="underline">Settings</a>
			</p>
		</div>
		<div class="flex gap-2">
			<button type="button" class="btn-secondary flex items-center gap-2" disabled={running || !overview.enabled} onclick={() => startRun('preview')} title="Changes no books and sends nothing to Audiobookshelf, but fills the attention queue">
				Preview
			</button>
			<button type="button" class="btn-accent flex items-center gap-2" disabled={running || !overview.enabled} onclick={() => startRun('apply')}>
				{#if running}<Loader2 class="w-4 h-4 animate-spin" />{:else}<RefreshCw class="w-4 h-4" />{/if}
				Sync Now
			</button>
		</div>
	</div>

	{#if !overview.enabled || !overview.configured || !overview.owner}
		<div class="card p-4 mb-6 text-sm" style="color: var(--text-secondary);">
			{#if !overview.configured}
				Audiobookshelf URL or API key is not set.
			{:else if !overview.enabled}
				Sync is off. Turn on <strong>Enable Audiobookshelf</strong> and <strong>Sync library items</strong> in
			{:else}
				No valid sync owner. Choose an admin or librarian in
			{/if}
			<a href="/admin/settings" class="underline" style="color: var(--accent);">Admin → Settings → Integrations</a>.
		</div>
	{/if}

	{#if overview.consecutiveScheduledFailures >= 2}
		<div class="card p-4 mb-6 flex items-start gap-3" style="border: 1px solid rgba(239, 68, 68, 0.4);">
			<AlertTriangle class="w-5 h-5 shrink-0" style="color: #ef4444;" />
			<p class="text-sm" style="color: var(--text-primary);">
				The last {overview.consecutiveScheduledFailures} scheduled runs failed{#if overview.lastApplyRun?.error}: {overview.lastApplyRun.error}{/if}.
				Scheduled runs now wait longer between attempts until one succeeds.
			</p>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="flex gap-2 mb-4">
		<button type="button" class={activeTab === 'runs' ? 'btn-accent' : 'btn-secondary'} onclick={() => (activeTab = 'runs')}>Runs</button>
		<button type="button" class={activeTab === 'attention' ? 'btn-accent' : 'btn-secondary'} onclick={() => (activeTab = 'attention')}>
			Needs attention{#if overview.attentionOpen > 0} ({overview.attentionOpen}){/if}
		</button>
		{#if overview.staleLinks > 0}
			<span class="self-center text-sm ml-2" style="color: #ef4444;">
				{overview.staleLinks} stale {overview.staleLinks === 1 ? 'link' : 'links'}: open the book and use Re-check or Change link
			</span>
		{/if}
	</div>

	{#if activeTab === 'runs'}
		<div class="card overflow-hidden">
			{#if runs.length === 0}
				<p class="p-4 text-sm" style="color: var(--text-muted);">No runs yet.</p>
			{:else}
				<div class="divide-y" style="border-color: var(--border-color);">
					{#each runs as run (run.id)}
						<div>
							<button type="button" class="w-full text-left px-4 py-3 flex items-start gap-3 hover:opacity-90" onclick={() => toggleRun(run.id)}>
								{#if expandedRunId === run.id}<ChevronDown class="w-4 h-4 mt-1 shrink-0" />{:else}<ChevronRight class="w-4 h-4 mt-1 shrink-0" />{/if}
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap text-sm">
										<span class="font-medium" style="color: var(--text-primary);">#{run.id}</span>
										<span style="color: var(--text-muted);">{formatTime(run.startedAt)}</span>
										<span class="px-2 py-0.5 rounded-full text-xs" style="background: var(--bg-tertiary); color: var(--text-secondary);">{run.triggerType}</span>
										{#if run.mode === 'preview'}
											<span class="px-2 py-0.5 rounded-full text-xs font-medium" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9;">preview</span>
										{/if}
										<span class="font-medium" style="color: {statusColor[run.status] ?? 'inherit'};">{run.status}</span>
										{#if run.durationMs !== null}<span style="color: var(--text-muted);">{formatDuration(run.durationMs)}</span>{/if}
										{#if run.alertedAt}<span class="text-xs" style="color: #ef4444;">alert sent</span>{/if}
									</div>
									<AbsRunSummary {run} />
									{#if run.error}<p class="text-sm" style="color: #ef4444;">{run.error}</p>{/if}
								</div>
							</button>
							{#if expandedRunId === run.id}
								<div class="px-11 pb-4 space-y-3">
									{#if !runDetails[run.id]}
										<Loader2 class="w-4 h-4 animate-spin" />
									{:else if runDetails[run.id].length === 0}
										<p class="text-sm" style="color: var(--text-muted);">Nothing changed.</p>
									{:else}
										{#each groupDetails(runDetails[run.id]) as [action, entries] (action)}
											<div>
												<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--text-muted);">
													{actionLabel(action, run.mode === 'preview')} ({entries.length})
												</p>
												<ul class="text-sm space-y-0.5" style="color: var(--text-secondary);">
													{#each entries as d, i (i)}
														<li>
															{#if d.bookId}<a href="/books/{d.bookId}" class="underline">{d.title ?? `Book #${d.bookId}`}</a>{:else}{d.title ?? d.absItemId ?? d.pass}{/if}
															{#if d.tier}<span style="color: var(--text-muted);"> · by {d.tier}</span>{/if}
															{#if d.fields?.length}<span style="color: var(--text-muted);"> · {d.fields.join(', ')}</span>{/if}
															{#if d.reason}<span style="color: {action === 'failed' ? '#ef4444' : 'var(--text-muted)'};"> · {d.reason}</span>{/if}
														</li>
													{/each}
												</ul>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex gap-2 mb-3">
			{#each ['open', 'ignored', 'resolved'] as const as f (f)}
				<button
					type="button"
					class="px-3 py-1 rounded-full text-sm"
					style={attentionFilter === f ? 'background: var(--accent); color: white;' : 'background: var(--bg-tertiary); color: var(--text-secondary);'}
					onclick={() => {
						attentionFilter = f;
						loadAttention();
					}}
				>
					{f[0].toUpperCase() + f.slice(1)}
				</button>
			{/each}
		</div>
		<div class="card overflow-hidden">
			{#if attention.length === 0}
				<p class="p-4 text-sm" style="color: var(--text-muted);">
					{attentionFilter === 'open' ? 'Nothing needs attention. A Preview run fills this list without changing any books.' : 'Nothing here.'}
				</p>
			{:else}
				<div class="divide-y" style="border-color: var(--border-color);">
					{#each attention as item (item.id)}
						<AbsAttentionRow {item} absBaseUrl={data.absBaseUrl} busy={busyAttentionId === item.id} onAction={attentionAction} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
