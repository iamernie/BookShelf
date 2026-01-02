<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Terminal, AlertCircle, AlertTriangle, Info, Bug, Wifi, Trash2, RefreshCw, Filter, Pause, Play } from 'lucide-svelte';

	interface LogEntry {
		id: string;
		timestamp: string;
		level: string;
		message: string;
		context?: string;
		meta?: Record<string, unknown>;
	}

	interface LogStats {
		total: number;
		byLevel: Record<string, number>;
	}

	let logs = $state<LogEntry[]>([]);
	let stats = $state<LogStats>({ total: 0, byLevel: {} });
	let isLoading = $state(true);
	let error = $state('');
	let selectedLevel = $state('');
	let selectedContext = $state('');
	let autoRefresh = $state(true);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let expandedLogs = $state<Set<string>>(new Set());

	const levelIcons: Record<string, typeof AlertCircle> = {
		error: AlertCircle,
		warn: AlertTriangle,
		info: Info,
		http: Wifi,
		debug: Bug
	};

	const levelColors: Record<string, string> = {
		error: '#ef4444',
		warn: '#f59e0b',
		info: '#22c55e',
		http: '#a855f7',
		debug: '#6b7280'
	};

	async function fetchLogs() {
		try {
			const params = new URLSearchParams();
			if (selectedLevel) params.set('level', selectedLevel);
			if (selectedContext) params.set('context', selectedContext);
			params.set('limit', '200');

			const response = await fetch(`/api/admin/logs?${params}`);
			if (!response.ok) {
				if (response.status === 403) {
					throw new Error('Admin access required to view logs');
				}
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `Failed to fetch logs (${response.status})`);
			}

			const data = await response.json();
			logs = data.logs || [];
			stats = data.stats || { total: 0, byLevel: {} };
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch logs';
		} finally {
			isLoading = false;
		}
	}

	async function clearLogs() {
		if (!confirm('Are you sure you want to clear all logs?')) return;

		try {
			const response = await fetch('/api/admin/logs', { method: 'DELETE' });
			if (!response.ok) {
				throw new Error('Failed to clear logs');
			}
			logs = [];
			stats = { total: 0, byLevel: {} };
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to clear logs';
		}
	}

	function toggleExpand(id: string) {
		const newSet = new Set(expandedLogs);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedLogs = newSet;
	}

	function formatMeta(meta: Record<string, unknown>): string {
		const filtered = Object.fromEntries(
			Object.entries(meta).filter(([k]) => !['timestamp', 'level', 'message', 'context'].includes(k))
		);
		if (Object.keys(filtered).length === 0) return '';
		return JSON.stringify(filtered, null, 2);
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			startRefreshInterval();
		} else if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	function startRefreshInterval() {
		if (refreshInterval) clearInterval(refreshInterval);
		refreshInterval = setInterval(fetchLogs, 3000);
	}

	onMount(() => {
		fetchLogs();
		if (autoRefresh) {
			startRefreshInterval();
		}
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});

	// Refetch when filters change
	$effect(() => {
		selectedLevel;
		selectedContext;
		fetchLogs();
	});
</script>

<svelte:head>
	<title>Console - BookShelf Admin</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: var(--bg-tertiary);">
				<Terminal class="w-5 h-5" style="color: var(--accent);" />
			</div>
			<div>
				<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Console</h1>
				<p class="text-sm" style="color: var(--text-muted);">View application logs and errors</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<button
				onclick={toggleAutoRefresh}
				class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
				style="background: var(--bg-tertiary); color: {autoRefresh ? 'var(--accent)' : 'var(--text-muted)'};"
			>
				{#if autoRefresh}
					<Pause class="w-4 h-4" />
					Auto-refresh ON
				{:else}
					<Play class="w-4 h-4" />
					Auto-refresh OFF
				{/if}
			</button>

			<button
				onclick={() => fetchLogs()}
				class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
				style="background: var(--bg-tertiary); color: var(--text-primary);"
			>
				<RefreshCw class="w-4 h-4" />
				Refresh
			</button>

			<button
				onclick={clearLogs}
				class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
				style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"
			>
				<Trash2 class="w-4 h-4" />
				Clear
			</button>
		</div>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-6 gap-3 mb-6">
		<div class="rounded-lg p-3" style="background: var(--bg-secondary);">
			<div class="text-2xl font-bold" style="color: var(--text-primary);">{stats.total}</div>
			<div class="text-xs" style="color: var(--text-muted);">Total</div>
		</div>
		{#each Object.entries(levelColors) as [level, color]}
			<button
				onclick={() => selectedLevel = selectedLevel === level ? '' : level}
				class="rounded-lg p-3 text-left transition-all"
				style="background: {selectedLevel === level ? color + '20' : 'var(--bg-secondary)'}; border: 2px solid {selectedLevel === level ? color : 'transparent'};"
			>
				<div class="text-2xl font-bold" style="color: {color};">{stats.byLevel[level] || 0}</div>
				<div class="text-xs capitalize" style="color: var(--text-muted);">{level}</div>
			</button>
		{/each}
	</div>

	<!-- Filters -->
	<div class="flex items-center gap-4 mb-4 p-3 rounded-lg" style="background: var(--bg-secondary);">
		<Filter class="w-4 h-4" style="color: var(--text-muted);" />
		<select
			bind:value={selectedLevel}
			class="px-3 py-1.5 rounded text-sm"
			style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
		>
			<option value="">All Levels</option>
			<option value="error">Error</option>
			<option value="warn">Warning</option>
			<option value="info">Info</option>
			<option value="http">HTTP</option>
			<option value="debug">Debug</option>
		</select>

		<input
			type="text"
			placeholder="Filter by context..."
			bind:value={selectedContext}
			class="px-3 py-1.5 rounded text-sm flex-1"
			style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
		/>

		{#if selectedLevel || selectedContext}
			<button
				onclick={() => { selectedLevel = ''; selectedContext = ''; }}
				class="text-sm px-2 py-1 rounded"
				style="color: var(--accent);"
			>
				Clear filters
			</button>
		{/if}
	</div>

	<!-- Error display -->
	{#if error}
		<div class="mb-4 p-4 rounded-lg flex items-center gap-2" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
			<AlertCircle class="w-5 h-5" />
			{error}
		</div>
	{/if}

	<!-- Log entries -->
	<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary);">
		{#if isLoading}
			<div class="p-8 text-center" style="color: var(--text-muted);">
				Loading logs...
			</div>
		{:else if logs.length === 0}
			<div class="p-8 text-center" style="color: var(--text-muted);">
				No logs to display
			</div>
		{:else}
			<div class="divide-y" style="border-color: var(--border-color);">
				{#each logs as log (log.id)}
					{@const Icon = levelIcons[log.level] || Info}
					{@const color = levelColors[log.level] || '#6b7280'}
					{@const meta = log.meta ? formatMeta(log.meta) : ''}
					{@const isExpanded = expandedLogs.has(log.id)}

					<div
						class="p-3 hover:bg-opacity-50 cursor-pointer transition-colors"
						style="background: {isExpanded ? 'var(--bg-tertiary)' : 'transparent'};"
						onclick={() => meta && toggleExpand(log.id)}
					>
						<div class="flex items-start gap-3">
							<!-- Level icon -->
							<div class="flex-shrink-0 mt-0.5">
								<Icon class="w-4 h-4" style="color: {color};" />
							</div>

							<!-- Content -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="text-xs font-mono" style="color: var(--text-muted);">
										{log.timestamp}
									</span>
									{#if log.context}
										<span class="text-xs px-1.5 py-0.5 rounded" style="background: var(--bg-tertiary); color: var(--text-secondary);">
											{log.context}
										</span>
									{/if}
									<span class="text-xs uppercase font-semibold" style="color: {color};">
										{log.level}
									</span>
								</div>
								<div class="font-mono text-sm break-all" style="color: var(--text-primary);">
									{log.message}
								</div>

								<!-- Expanded meta -->
								{#if isExpanded && meta}
									<pre class="mt-2 p-2 rounded text-xs overflow-x-auto" style="background: var(--bg-primary); color: var(--text-secondary);">{meta}</pre>
								{/if}
							</div>

							<!-- Expand indicator -->
							{#if meta}
								<div class="flex-shrink-0 text-xs" style="color: var(--text-muted);">
									{isExpanded ? '▼' : '▶'}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
