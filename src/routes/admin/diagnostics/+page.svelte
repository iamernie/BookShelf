<script lang="ts">
	import {
		Activity,
		Database,
		HardDrive,
		Users,
		Book,
		AlertTriangle,
		CheckCircle,
		Info,
		Wrench,
		RefreshCw,
		Loader2,
		Trash2,
		XCircle,
		Library,
		Globe,
		FileText,
		BookOpen,
		User,
		ShoppingBag
	} from 'lucide-svelte';

	let { data } = $props();

	let loading = $state(false);
	let repairLoading = $state<string | null>(null);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let health = $state(data.health);

	async function refreshDiagnostics() {
		loading = true;
		message = null;

		try {
			const res = await fetch('/api/admin/diagnostics');
			if (res.ok) {
				health = await res.json();
				message = { type: 'success', text: 'Diagnostics refreshed' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to refresh diagnostics' };
		} finally {
			loading = false;
		}
	}

	async function runRepair(repairType: string) {
		repairLoading = repairType;
		message = null;

		try {
			const res = await fetch('/api/admin/diagnostics/repair', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: repairType })
			});

			const result = await res.json();

			if (res.ok) {
				message = {
					type: 'success',
					text: `Repair complete: ${result.repaired} items fixed`
				};
				// Refresh diagnostics
				await refreshDiagnostics();
			} else {
				message = { type: 'error', text: result.message || 'Repair failed' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to run repair' };
		} finally {
			repairLoading = null;
		}
	}

	async function runAllRepairs() {
		repairLoading = 'all';
		message = null;

		try {
			const res = await fetch('/api/admin/diagnostics/repair', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'all' })
			});

			const result = await res.json();

			if (res.ok) {
				message = {
					type: 'success',
					text: `All repairs complete: ${result.totalRepaired} items fixed`
				};
				await refreshDiagnostics();
			} else {
				message = { type: 'error', text: result.message || 'Repairs failed' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to run repairs' };
		} finally {
			repairLoading = null;
		}
	}

	function getSeverityColor(severity: string) {
		switch (severity) {
			case 'error':
				return 'text-red-500';
			case 'warning':
				return 'text-yellow-500';
			default:
				return 'text-blue-500';
		}
	}

	function getSeverityIcon(severity: string) {
		switch (severity) {
			case 'error':
				return XCircle;
			case 'warning':
				return AlertTriangle;
			default:
				return Info;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'healthy':
				return 'bg-green-500';
			case 'warning':
				return 'bg-yellow-500';
			default:
				return 'bg-red-500';
		}
	}
</script>

<svelte:head>
	<title>System Diagnostics - BookShelf Admin</title>
</svelte:head>

<div class="p-6 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">System Diagnostics</h1>
			<p style="color: var(--text-secondary);">Monitor system health and repair database issues</p>
		</div>

		<div class="flex gap-3">
			<button
				class="btn-secondary flex items-center gap-2"
				onclick={refreshDiagnostics}
				disabled={loading}
			>
				{#if loading}
					<Loader2 class="w-4 h-4 animate-spin" />
				{:else}
					<RefreshCw class="w-4 h-4" />
				{/if}
				Refresh
			</button>

			{#if health.issues.length > 0}
				<button
					class="btn-accent flex items-center gap-2"
					onclick={runAllRepairs}
					disabled={repairLoading !== null}
				>
					{#if repairLoading === 'all'}
						<Loader2 class="w-4 h-4 animate-spin" />
					{:else}
						<Wrench class="w-4 h-4" />
					{/if}
					Repair All
				</button>
			{/if}
		</div>
	</div>

	<!-- Message -->
	{#if message}
		<div
			class="mb-6 p-4 rounded-lg flex items-center gap-3 {message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}"
			style="border-width: 1px;"
		>
			{#if message.type === 'success'}
				<CheckCircle class="w-5 h-5" />
			{:else}
				<XCircle class="w-5 h-5" />
			{/if}
			{message.text}
		</div>
	{/if}

	<!-- Status Overview -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
		<!-- System Status -->
		<div class="card p-4">
			<div class="flex items-center gap-3 mb-3">
				<div class="w-10 h-10 rounded-lg flex items-center justify-center {getStatusColor(health.status)}">
					<Activity class="w-5 h-5 text-white" />
				</div>
				<div>
					<h3 class="font-semibold" style="color: var(--text-primary);">System Status</h3>
					<p class="text-sm capitalize" style="color: var(--text-secondary);">{health.status}</p>
				</div>
			</div>
			<p class="text-sm" style="color: var(--text-muted);">
				{health.issues.length === 0 ? 'No issues detected' : `${health.issues.length} issue(s) found`}
			</p>
		</div>

		<!-- Database -->
		<div class="card p-4">
			<div class="flex items-center gap-3 mb-3">
				<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background-color: var(--accent);">
					<Database class="w-5 h-5 text-white" />
				</div>
				<div>
					<h3 class="font-semibold" style="color: var(--text-primary);">Database</h3>
					<p class="text-sm" style="color: var(--text-secondary);">{health.database.size}</p>
				</div>
			</div>
			<p class="text-sm truncate" style="color: var(--text-muted);">{health.database.path}</p>
		</div>

		<!-- Storage -->
		<div class="card p-4">
			<div class="flex items-center gap-3 mb-3">
				<div class="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500">
					<HardDrive class="w-5 h-5 text-white" />
				</div>
				<div>
					<h3 class="font-semibold" style="color: var(--text-primary);">Storage</h3>
					<p class="text-sm" style="color: var(--text-secondary);">
						Covers: {health.storage.coversSize} | Ebooks: {health.storage.ebooksSize}
					</p>
				</div>
			</div>
			<p class="text-sm" style="color: var(--text-muted);">
				{health.storage.coversCount} covers, {health.storage.ebooksCount} ebooks
			</p>
		</div>
	</div>

	<!-- Data Counts -->
	<div class="card p-4 mb-6">
		<h3 class="font-semibold mb-4" style="color: var(--text-primary);">Database Tables</h3>
		<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
			<div class="text-center">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.books}</div>
				<div class="text-sm" style="color: var(--text-muted);">Books</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.authors}</div>
				<div class="text-sm" style="color: var(--text-muted);">Authors</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.series}</div>
				<div class="text-sm" style="color: var(--text-muted);">Series</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.genres}</div>
				<div class="text-sm" style="color: var(--text-muted);">Genres</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.mediaSources}</div>
				<div class="text-sm" style="color: var(--text-muted);">Media Sources</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.users}</div>
				<div class="text-sm" style="color: var(--text-muted);">Users</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.sessions}</div>
				<div class="text-sm" style="color: var(--text-muted);">Sessions</div>
			</div>
		</div>
	</div>

	<!-- Media Sources -->
	<div class="card p-4 mb-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-500">
				<ShoppingBag class="w-5 h-5 text-white" />
			</div>
			<div>
				<h3 class="font-semibold" style="color: var(--text-primary);">Media Sources</h3>
				<p class="text-sm" style="color: var(--text-secondary);">Where books are purchased or owned</p>
			</div>
		</div>
		<div class="grid grid-cols-3 gap-4">
			<div class="p-3 rounded-lg text-center" style="background-color: var(--bg-tertiary);">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.mediaSources}</div>
				<div class="text-sm" style="color: var(--text-muted);">Total Sources</div>
			</div>
			<div class="p-3 rounded-lg text-center" style="background-color: var(--bg-tertiary);">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.systemMediaSources}</div>
				<div class="text-sm" style="color: var(--text-muted);">System Sources</div>
			</div>
			<div class="p-3 rounded-lg text-center" style="background-color: var(--bg-tertiary);">
				<div class="text-2xl font-bold" style="color: var(--accent);">{health.counts.userMediaSources}</div>
				<div class="text-sm" style="color: var(--text-muted);">User Sources</div>
			</div>
		</div>
	</div>

	<!-- Library Statistics -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
		<!-- Total Library -->
		<div class="card p-4">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
					<Library class="w-5 h-5 text-white" />
				</div>
				<div>
					<h3 class="font-semibold" style="color: var(--text-primary);">Total Library</h3>
					<p class="text-sm" style="color: var(--text-secondary);">All books in the system</p>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="flex items-center gap-2 mb-1">
						<Book class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-muted);">Books</span>
					</div>
					<div class="text-xl font-bold" style="color: var(--accent);">{health.libraryStats.total.totalBooks}</div>
				</div>
				<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="flex items-center gap-2 mb-1">
						<FileText class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-muted);">With Ebooks</span>
					</div>
					<div class="text-xl font-bold" style="color: var(--accent);">{health.libraryStats.total.booksWithEbooks}</div>
				</div>
				<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="flex items-center gap-2 mb-1">
						<User class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-muted);">Authors (linked)</span>
					</div>
					<div class="text-xl font-bold" style="color: var(--accent);">{health.libraryStats.total.totalAuthors}</div>
				</div>
				<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="flex items-center gap-2 mb-1">
						<BookOpen class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-muted);">Series (linked)</span>
					</div>
					<div class="text-xl font-bold" style="color: var(--accent);">{health.libraryStats.total.totalSeries}</div>
				</div>
			</div>
		</div>

		<!-- Public Library -->
		<div class="card p-4">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500">
					<Globe class="w-5 h-5 text-white" />
				</div>
				<div>
					<h3 class="font-semibold" style="color: var(--text-primary);">Public Library</h3>
					<p class="text-sm" style="color: var(--text-secondary);">Shared books available to all users</p>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="flex items-center gap-2 mb-1">
						<Book class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-muted);">Books</span>
					</div>
					<div class="text-xl font-bold" style="color: var(--accent);">{health.libraryStats.publicLibrary.totalBooks}</div>
				</div>
				<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="flex items-center gap-2 mb-1">
						<FileText class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-muted);">With Ebooks</span>
					</div>
					<div class="text-xl font-bold" style="color: var(--accent);">{health.libraryStats.publicLibrary.booksWithEbooks}</div>
				</div>
				<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="flex items-center gap-2 mb-1">
						<User class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-muted);">Authors (linked)</span>
					</div>
					<div class="text-xl font-bold" style="color: var(--accent);">{health.libraryStats.publicLibrary.totalAuthors}</div>
				</div>
				<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="flex items-center gap-2 mb-1">
						<BookOpen class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-muted);">Series (linked)</span>
					</div>
					<div class="text-xl font-bold" style="color: var(--accent);">{health.libraryStats.publicLibrary.totalSeries}</div>
				</div>
			</div>
		</div>
	</div>

	<!-- User Libraries -->
	<div class="card p-4 mb-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500">
				<Users class="w-5 h-5 text-white" />
			</div>
			<div>
				<h3 class="font-semibold" style="color: var(--text-primary);">User Libraries</h3>
				<p class="text-sm" style="color: var(--text-secondary);">Books in each user's personal library</p>
			</div>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr style="border-bottom: 1px solid var(--border-color);">
						<th class="text-left py-2 px-3 text-sm font-medium" style="color: var(--text-muted);">User</th>
						<th class="text-left py-2 px-3 text-sm font-medium" style="color: var(--text-muted);">Email</th>
						<th class="text-right py-2 px-3 text-sm font-medium" style="color: var(--text-muted);">Books</th>
					</tr>
				</thead>
				<tbody>
					{#each health.libraryStats.userLibraries as user}
						<tr style="border-bottom: 1px solid var(--border-color);">
							<td class="py-2 px-3" style="color: var(--text-primary);">
								<div class="flex items-center gap-2">
									<User class="w-4 h-4" style="color: var(--text-muted);" />
									{user.username}
								</div>
							</td>
							<td class="py-2 px-3" style="color: var(--text-secondary);">{user.email}</td>
							<td class="py-2 px-3 text-right">
								<span class="px-2 py-1 rounded-full text-sm font-medium" style="background-color: var(--accent); color: white;">
									{user.bookCount}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Issues -->
	<div class="card p-4">
		<h3 class="font-semibold mb-4" style="color: var(--text-primary);">Issues & Repairs</h3>

		{#if health.issues.length === 0}
			<div class="flex items-center gap-3 p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
				<CheckCircle class="w-5 h-5 text-green-500" />
				<span style="color: var(--text-primary);">No issues detected. Your database is healthy!</span>
			</div>
		{:else}
			<div class="space-y-3">
				{#each health.issues as issue}
					{@const Icon = getSeverityIcon(issue.severity)}
					<div class="flex items-center justify-between p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
						<div class="flex items-center gap-3">
							<Icon class="w-5 h-5 {getSeverityColor(issue.severity)}" />
							<div>
								<div class="font-medium" style="color: var(--text-primary);">
									{issue.description}
								</div>
								<div class="text-sm" style="color: var(--text-muted);">
									{issue.count} {issue.entity} • {issue.type}
								</div>
							</div>
						</div>

						{#if issue.canRepair}
							<button
								class="btn-secondary text-sm flex items-center gap-2"
								onclick={() => runRepair(issue.entity)}
								disabled={repairLoading !== null}
							>
								{#if repairLoading === issue.entity}
									<Loader2 class="w-4 h-4 animate-spin" />
								{:else}
									<Wrench class="w-4 h-4" />
								{/if}
								Repair
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Quick Actions -->
	<div class="card p-4 mt-6">
		<h3 class="font-semibold mb-4" style="color: var(--text-primary);">Quick Actions</h3>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<button
				class="p-4 rounded-lg text-left transition-colors hover:opacity-80"
				style="background-color: var(--bg-tertiary);"
				onclick={() => runRepair('sessions')}
				disabled={repairLoading !== null}
			>
				<div class="flex items-center gap-3 mb-2">
					{#if repairLoading === 'sessions'}
						<Loader2 class="w-5 h-5 animate-spin" style="color: var(--accent);" />
					{:else}
						<Trash2 class="w-5 h-5" style="color: var(--accent);" />
					{/if}
					<span class="font-medium" style="color: var(--text-primary);">Clean Sessions</span>
				</div>
				<p class="text-sm" style="color: var(--text-muted);">Remove expired user sessions</p>
			</button>

			<button
				class="p-4 rounded-lg text-left transition-colors hover:opacity-80"
				style="background-color: var(--bg-tertiary);"
				onclick={() => runRepair('orphaned')}
				disabled={repairLoading !== null}
			>
				<div class="flex items-center gap-3 mb-2">
					{#if repairLoading === 'orphaned'}
						<Loader2 class="w-5 h-5 animate-spin" style="color: var(--accent);" />
					{:else}
						<Wrench class="w-5 h-5" style="color: var(--accent);" />
					{/if}
					<span class="font-medium" style="color: var(--text-primary);">Clean Orphans</span>
				</div>
				<p class="text-sm" style="color: var(--text-muted);">Remove orphaned relationships</p>
			</button>

			<button
				class="p-4 rounded-lg text-left transition-colors hover:opacity-80"
				style="background-color: var(--bg-tertiary);"
				onclick={() => runRepair('references')}
				disabled={repairLoading !== null}
			>
				<div class="flex items-center gap-3 mb-2">
					{#if repairLoading === 'references'}
						<Loader2 class="w-5 h-5 animate-spin" style="color: var(--accent);" />
					{:else}
						<Database class="w-5 h-5" style="color: var(--accent);" />
					{/if}
					<span class="font-medium" style="color: var(--text-primary);">Fix References</span>
				</div>
				<p class="text-sm" style="color: var(--text-muted);">Fix invalid foreign key references</p>
			</button>
		</div>
	</div>
</div>
