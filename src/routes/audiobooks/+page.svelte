<script lang="ts">
	import { Headphones, Plus, Search, Clock, Play, MoreVertical, Grid, List as ListIcon, Filter, BookOpen } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	// Get the appropriate link for an audiobook
	function getAudiobookLink(audiobook: typeof data.audiobooks.items[0]): string {
		if (audiobook.bookId) {
			return `/books/${audiobook.bookId}?listen=true`;
		}
		return `/audiobooks/${audiobook.id}`;
	}

	let viewMode = $state<'grid' | 'list'>('grid');
	let searchQuery = $state(data.search || '');
	let showFilters = $state(false);

	function formatDuration(seconds: number): string {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);

		if (hrs > 0) {
			return `${hrs}h ${mins}m`;
		}
		return `${mins}m`;
	}

	function getProgressPercent(audiobook: typeof data.audiobooks.items[0]): number {
		if (!audiobook.userProgress) return 0;
		return Math.round((audiobook.userProgress.progress ?? 0) * 100);
	}

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (data.filter !== 'all') params.set('filter', data.filter);
		if (data.sortBy !== 'createdAt') params.set('sortBy', data.sortBy);
		if (data.sortOrder !== 'desc') params.set('sortOrder', data.sortOrder);
		goto(`/audiobooks?${params.toString()}`);
	}

	function setFilter(filter: string) {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (filter !== 'all') params.set('filter', filter);
		if (data.sortBy !== 'createdAt') params.set('sortBy', data.sortBy);
		if (data.sortOrder !== 'desc') params.set('sortOrder', data.sortOrder);
		goto(`/audiobooks?${params.toString()}`);
	}
</script>

<svelte:head>
	<title>Audiobooks | BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
		<div class="flex items-center gap-3">
			<Headphones class="w-8 h-8" style="color: var(--accent);" />
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Audiobooks</h1>
		</div>

		<div class="flex items-center gap-3">
			<!-- Search -->
			<form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="relative">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color: var(--text-muted);" />
				<input
					type="text"
					placeholder="Search audiobooks..."
					bind:value={searchQuery}
					class="pl-9 pr-4 py-2 rounded-lg border text-sm w-48 sm:w-64"
					style="background: var(--card-bg); border-color: var(--border-color); color: var(--text-primary);"
				/>
			</form>

			<!-- View toggle -->
			<div class="flex items-center gap-1 rounded-lg p-1" style="background: var(--bg-secondary);">
				<button
					onclick={() => viewMode = 'grid'}
					class="p-2 rounded-md transition-colors"
					style={viewMode === 'grid' ? 'background: var(--card-bg);' : ''}
					title="Grid view"
				>
					<Grid class="w-4 h-4" style="color: var(--text-primary);" />
				</button>
				<button
					onclick={() => viewMode = 'list'}
					class="p-2 rounded-md transition-colors"
					style={viewMode === 'list' ? 'background: var(--card-bg);' : ''}
					title="List view"
				>
					<ListIcon class="w-4 h-4" style="color: var(--text-primary);" />
				</button>
			</div>

			<!-- Add button -->
			<a
				href="/audiobooks/upload"
				class="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
				style="background: var(--accent);"
			>
				<Plus class="w-4 h-4" />
				<span class="hidden sm:inline">Add</span>
			</a>
		</div>
	</div>

	<!-- Continue Listening Section -->
	{#if data.continueListening.length > 0}
		<section class="mb-8">
			<h2 class="text-lg font-semibold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
				<Play class="w-5 h-5" style="color: var(--accent);" />
				Continue Listening
			</h2>

			<div class="flex gap-4 overflow-x-auto pb-2">
				{#each data.continueListening as audiobook}
					<a
						href={getAudiobookLink(audiobook)}
						class="flex-shrink-0 w-40 group"
					>
						<div class="relative aspect-square rounded-lg overflow-hidden mb-2" style="background: var(--bg-secondary);">
							{#if audiobook.coverPath}
								<img
									src={audiobook.coverPath}
									alt={audiobook.title}
									class="w-full h-full object-cover"
									onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
								/>
							{:else}
								<div class="w-full h-full flex items-center justify-center">
									<Headphones class="w-12 h-12" style="color: var(--text-muted);" />
								</div>
							{/if}

							<!-- Progress overlay -->
							<div class="absolute bottom-0 left-0 right-0 h-1" style="background: var(--bg-secondary);">
								<div
									class="h-full transition-all"
									style="width: {getProgressPercent(audiobook)}%; background: var(--accent);"
								></div>
							</div>

							<!-- Play overlay -->
							<div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
								<Play class="w-12 h-12 text-white" />
							</div>
						</div>

						<h3 class="font-medium text-sm truncate" style="color: var(--text-primary);">{audiobook.title}</h3>
						<p class="text-xs truncate" style="color: var(--text-muted);">{audiobook.author || 'Unknown'}</p>
						<p class="text-xs" style="color: var(--text-muted);">{getProgressPercent(audiobook)}% complete</p>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Filter tabs -->
	<div class="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
		{#each [
			{ key: 'all', label: 'All' },
			{ key: 'in_progress', label: 'In Progress' },
			{ key: 'not_started', label: 'Not Started' },
			{ key: 'completed', label: 'Completed' }
		] as filterOption}
			<button
				onclick={() => setFilter(filterOption.key)}
				class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
				style={data.filter === filterOption.key
					? 'background: var(--accent); color: white;'
					: 'background: var(--bg-secondary); color: var(--text-muted);'
				}
			>
				{filterOption.label}
			</button>
		{/each}
	</div>

	<!-- Library grid/list -->
	{#if data.audiobooks.items.length === 0}
		<div class="text-center py-16">
			<Headphones class="w-16 h-16 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">
				{#if data.search}
					No audiobooks found
				{:else if data.filter !== 'all'}
					No {data.filter.replace('_', ' ')} audiobooks
				{:else}
					No audiobooks yet
				{/if}
			</h3>
			<p class="mb-6" style="color: var(--text-muted);">
				{#if data.search}
					Try a different search term
				{:else}
					Add an audiobook to a book to get started
				{/if}
			</p>
			{#if !data.search}
				<a
					href="/audiobooks/upload"
					class="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium"
					style="background: var(--accent);"
				>
					<Plus class="w-5 h-5" />
					Add Audiobook
				</a>
			{/if}
		</div>
	{:else if viewMode === 'grid'}
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
			{#each data.audiobooks.items as audiobook}
				<a
					href={getAudiobookLink(audiobook)}
					class="group"
				>
					<div class="relative aspect-square rounded-lg overflow-hidden mb-2" style="background: var(--bg-secondary);">
						{#if audiobook.coverPath}
							<img
								src={audiobook.coverPath}
								alt={audiobook.title}
								class="w-full h-full object-cover"
								onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
							/>
						{:else}
							<div class="w-full h-full flex items-center justify-center">
								<Headphones class="w-12 h-12" style="color: var(--text-muted);" />
							</div>
						{/if}

						<!-- Duration badge -->
						<div class="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium" style="background: rgba(0,0,0,0.7); color: white;">
							{formatDuration(audiobook.duration ?? 0)}
						</div>

						<!-- Progress bar if started -->
						{#if audiobook.userProgress && (audiobook.userProgress.progress ?? 0) > 0}
							<div class="absolute bottom-0 left-0 right-0 h-1" style="background: rgba(0,0,0,0.5);">
								<div
									class="h-full"
									style="width: {getProgressPercent(audiobook)}%; background: var(--accent);"
								></div>
							</div>
						{/if}

						<!-- Play overlay -->
						<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
							<Play class="w-12 h-12 text-white" />
						</div>
					</div>

					<h3 class="font-medium text-sm line-clamp-2" style="color: var(--text-primary);">{audiobook.title}</h3>
					<p class="text-xs truncate" style="color: var(--text-muted);">{audiobook.author || 'Unknown author'}</p>
				</a>
			{/each}
		</div>
	{:else}
		<!-- List view -->
		<div class="space-y-2">
			{#each data.audiobooks.items as audiobook}
				<a
					href={getAudiobookLink(audiobook)}
					class="flex items-center gap-4 p-4 rounded-lg transition-colors"
					style="background: var(--card-bg);"
				>
					<div class="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0" style="background: var(--bg-secondary);">
						{#if audiobook.coverPath}
							<img
								src={audiobook.coverPath}
								alt={audiobook.title}
								class="w-full h-full object-cover"
								onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
							/>
						{:else}
							<div class="w-full h-full flex items-center justify-center">
								<Headphones class="w-8 h-8" style="color: var(--text-muted);" />
							</div>
						{/if}
					</div>

					<div class="flex-1 min-w-0">
						<h3 class="font-medium truncate" style="color: var(--text-primary);">{audiobook.title}</h3>
						<p class="text-sm truncate" style="color: var(--text-muted);">{audiobook.author || 'Unknown author'}</p>
						<div class="flex items-center gap-4 mt-1">
							<span class="text-xs" style="color: var(--text-muted);">
								<Clock class="w-3 h-3 inline mr-1" />
								{formatDuration(audiobook.duration ?? 0)}
							</span>
							{#if audiobook.userProgress && (audiobook.userProgress.progress ?? 0) > 0}
								<span class="text-xs" style="color: var(--accent);">
									{getProgressPercent(audiobook)}% complete
								</span>
							{/if}
						</div>
					</div>

					<button class="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors" onclick={(e) => e.preventDefault()}>
						<MoreVertical class="w-5 h-5" style="color: var(--text-muted);" />
					</button>
				</a>
			{/each}
		</div>
	{/if}
</div>
