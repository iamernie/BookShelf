<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import {
		BookOpen,
		TrendingUp,
		Users,
		Library,
		Target,
		Trophy,
		ArrowUp,
		ArrowDown,
		Minus,
		BookMarked,
		Clock,
		Star,
		BarChart3,
		PieChart,
		Shuffle,
		Layers,
		Settings,
		ChevronRight,
		CheckCircle2,
		Hash,
		Sparkles,
		Headphones,
		BookX,
		FileText,
		Mic2
	} from 'lucide-svelte';
	import BookCard from '$lib/components/book/BookCard.svelte';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';
	import DashboardSettingsModal from '$lib/components/dashboard/DashboardSettingsModal.svelte';
	import SmartCollectionSection from '$lib/components/dashboard/SmartCollectionSection.svelte';
	import type { BookCardData } from '$lib/types';
	import type { DashboardConfig, DashboardSection, DashboardSectionId } from '$lib/server/services/userPreferencesService';
	import { toasts } from '$lib/stores/toast';

	let { data } = $props();

	// Dashboard settings modal state
	let showSettingsModal = $state(false);

	// Get enabled sections in order
	const enabledSections = $derived(
		data.dashboardConfig?.sections
			?.filter(s => s.enabled)
			.sort((a, b) => a.order - b.order) || []
	);

	// Check if a section is enabled
	function isSectionEnabled(id: DashboardSectionId): boolean {
		return enabledSections.some(s => s.id === id);
	}

	function handleBookClick(book: BookCardData) {
		goto(`/books/${book.id}`);
	}

	async function handleQuickEdit(bookId: number, field: string, value: any) {
		const res = await fetch(`/api/books/${bookId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ [field]: value })
		});
		if (res.ok) {
			toasts.success(`Updated ${field === 'statusId' ? 'status' : field}`);
			invalidateAll();
		} else {
			const err = await res.json();
			toasts.error(err.message || `Failed to update ${field}`);
		}
	}

	function getPaceColor(status: string) {
		switch (status) {
			case 'ahead': return '#22c55e';
			case 'behind': return '#ef4444';
			default: return '#eab308';
		}
	}

	async function refreshRandomPick() {
		await invalidateAll();
		toasts.success('New random pick!');
	}

	// Calculate max for bar chart
	const maxMonthlyCount = $derived(Math.max(...data.monthlyReading.map(m => m.count), 1));

	// Save dashboard config
	async function saveDashboardConfig(config: DashboardConfig) {
		try {
			const res = await fetch('/api/dashboard/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ config })
			});

			if (res.ok) {
				toasts.success('Dashboard settings saved');
				await invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save settings');
			}
		} catch (e) {
			toasts.error('Failed to save settings');
		}
	}
</script>

<svelte:head>
	<title>Dashboard | BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Dashboard</h1>
		<button
			type="button"
			class="p-2 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
			style="color: var(--text-muted);"
			onclick={() => showSettingsModal = true}
			title="Customize dashboard"
		>
			<Settings class="w-5 h-5" />
		</button>
	</div>

	<!-- Primary Stats (larger cards) -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
		<div class="stat-card-lg">
			<div class="stat-icon-lg" style="background-color: rgba(59, 130, 246, 0.1);">
				<BookOpen class="w-6 h-6" style="color: #3b82f6;" />
			</div>
			<div class="stat-content-lg">
				<p class="stat-value-lg">{data.stats.totalBooks}</p>
				<p class="stat-label-lg">Total Books</p>
			</div>
		</div>

		<div class="stat-card-lg">
			<div class="stat-icon-lg" style="background-color: rgba(34, 197, 94, 0.1);">
				<TrendingUp class="w-6 h-6" style="color: #22c55e;" />
			</div>
			<div class="stat-content-lg">
				<p class="stat-value-lg">{data.stats.readThisYear}</p>
				<p class="stat-label-lg">Read This Year</p>
			</div>
		</div>

		<div class="stat-card-lg">
			<div class="stat-icon-lg" style="background-color: rgba(168, 85, 247, 0.1);">
				<BookMarked class="w-6 h-6" style="color: #a855f7;" />
			</div>
			<div class="stat-content-lg">
				<p class="stat-value-lg">{data.stats.currentlyReading}</p>
				<p class="stat-label-lg">Currently Reading</p>
			</div>
		</div>

		<div class="stat-card-lg">
			<div class="stat-icon-lg" style="background-color: rgba(249, 115, 22, 0.1);">
				<Layers class="w-6 h-6" style="color: #f97316;" />
			</div>
			<div class="stat-content-lg">
				<p class="stat-value-lg">{data.stats.toBeRead}</p>
				<p class="stat-label-lg">To Be Read</p>
			</div>
		</div>
	</div>

	<!-- Secondary Stats (smaller row) -->
	<div class="grid grid-cols-4 md:grid-cols-8 gap-3 mb-6">
		<div class="stat-card-sm">
			<Users class="w-4 h-4" style="color: #ec4899;" />
			<span class="stat-value-sm">{data.stats.totalAuthors}</span>
			<span class="stat-label-sm">Authors</span>
		</div>

		<div class="stat-card-sm">
			<Library class="w-4 h-4" style="color: #0ea5e9;" />
			<span class="stat-value-sm">{data.stats.totalSeries}</span>
			<span class="stat-label-sm">Series</span>
		</div>

		<div class="stat-card-sm">
			<Star class="w-4 h-4" style="color: #eab308;" />
			<span class="stat-value-sm">{data.stats.avgRating?.toFixed(1) || '-'}</span>
			<span class="stat-label-sm">Avg Rating</span>
		</div>

		<div class="stat-card-sm">
			<BarChart3 class="w-4 h-4" style="color: #6366f1;" />
			<span class="stat-value-sm">{(data.stats.pagesThisYear / 1000).toFixed(1)}k</span>
			<span class="stat-label-sm">Pages Read</span>
		</div>

		<div class="stat-card-sm">
			<FileText class="w-4 h-4" style="color: #14b8a6;" />
			<span class="stat-value-sm">{data.stats.avgPagesPerBook}</span>
			<span class="stat-label-sm">Avg Pages</span>
		</div>

		<div class="stat-card-sm">
			<Mic2 class="w-4 h-4" style="color: #8b5cf6;" />
			<span class="stat-value-sm">{data.stats.totalNarrators}</span>
			<span class="stat-label-sm">Narrators</span>
		</div>

		{#if data.stats.totalListeningHours > 0}
		<div class="stat-card-sm">
			<Headphones class="w-4 h-4" style="color: #f59e0b;" />
			<span class="stat-value-sm">{data.stats.totalListeningHours}h</span>
			<span class="stat-label-sm">Listened</span>
		</div>
		{/if}

		{#if data.stats.dnfCount > 0}
		<div class="stat-card-sm">
			<BookX class="w-4 h-4" style="color: #ef4444;" />
			<span class="stat-value-sm">{data.stats.dnfRate}%</span>
			<span class="stat-label-sm">DNF Rate</span>
		</div>
		{/if}
	</div>

	<!-- Main Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Left Column (2/3) -->
		<div class="lg:col-span-2 space-y-6">
			<!-- Reading Goal Widget -->
			{#if data.goalData && isSectionEnabled('reading-goal')}
				<section class="card p-4">
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-lg font-semibold flex items-center gap-2" style="color: var(--text-primary);">
							<Target class="w-5 h-5" style="color: var(--accent);" />
							{data.goalData.year} Reading Goal
						</h2>
						<a href="/stats/goals" class="text-sm flex items-center gap-1 hover:underline" style="color: var(--accent);">
							View all
							<ChevronRight class="w-4 h-4" />
						</a>
					</div>

					<div class="flex items-center gap-4 mb-3">
						<div class="flex items-baseline gap-2">
							<span class="text-3xl font-bold" style="color: var(--text-primary);">{data.goalData.booksRead}</span>
							<span class="text-lg" style="color: var(--text-muted);">/ {data.goalData.targetBooks}</span>
						</div>
						{#if data.goalData.progress >= 100}
							<div class="flex items-center gap-1">
								<Trophy class="w-5 h-5 text-yellow-500" />
								<span class="text-sm font-medium text-yellow-600">Goal achieved!</span>
							</div>
						{:else}
							<span class="text-sm" style="color: var(--text-muted);">{data.goalData.remaining} to go</span>
						{/if}
					</div>

					<div class="mb-3">
						<div class="h-2.5 rounded-full overflow-hidden" style="background-color: var(--border-color);">
							<div
								class="h-full rounded-full transition-all duration-500"
								style="width: {Math.min(data.goalData.progress, 100)}%; background-color: {data.goalData.progress >= 100 ? '#22c55e' : 'var(--accent)'};"
							></div>
						</div>
						<div class="flex justify-between text-xs mt-1" style="color: var(--text-muted);">
							<span>{data.goalData.progress}% complete</span>
							<div class="flex items-center gap-1">
								{#if data.goalData.paceStatus === 'ahead'}
									<ArrowUp class="w-3 h-3" style="color: #22c55e;" />
									<span style="color: #22c55e;">{data.goalData.paceDiff} ahead</span>
								{:else if data.goalData.paceStatus === 'behind'}
									<ArrowDown class="w-3 h-3" style="color: #ef4444;" />
									<span style="color: #ef4444;">{data.goalData.paceDiff} behind</span>
								{:else}
									<Minus class="w-3 h-3" style="color: #eab308;" />
									<span style="color: #eab308;">On track</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Challenge Summary -->
					{#if data.goalData.challenges && data.goalData.challenges.length > 1}
						<div class="pt-3 border-t" style="border-color: var(--border-color);">
							<p class="text-xs font-medium mb-2" style="color: var(--text-muted);">Active Challenges</p>
							<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
								{#each data.goalData.challenges.filter(c => c.type !== 'books').slice(0, 3) as challenge}
									<div class="flex items-center gap-2 p-2 rounded" style="background-color: var(--bg-tertiary);">
										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between text-xs mb-0.5">
												<span class="truncate" style="color: var(--text-primary);">{challenge.typeInfo.name}</span>
												<span style="color: {challenge.isComplete ? '#22c55e' : 'var(--text-muted)'};">
													{challenge.current}/{challenge.target}
												</span>
											</div>
											<div class="h-1 rounded-full overflow-hidden" style="background-color: var(--border-color);">
												<div
													class="h-full rounded-full"
													style="width: {challenge.progress}%; background-color: {challenge.isComplete ? '#22c55e' : 'var(--accent)'};"
												></div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</section>
			{/if}

			<!-- Currently Reading with Companion Section -->
			{#if isSectionEnabled('continue-reading')}
				{@const continueReadingSection = data.dashboardConfig?.sections.find(s => s.id === 'continue-reading')}
				{@const companionType = continueReadingSection?.companionSection || 'up-next-series'}
				{@const showCompanion = companionType !== 'none'}
				{@const hasContinueReading = data.continueReading.length > 0}
				{@const hasUpNext = data.upNextInSeries.length > 0}
				{@const hasCompanionData = companionType === 'up-next-series' ? hasUpNext : (companionType === 'smart-collection' && data.companionSmartCollectionData)}

				{#if hasContinueReading || hasCompanionData}
					<div class={showCompanion && hasCompanionData ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''}>
						<!-- Currently Reading -->
						{#if hasContinueReading}
							<section>
								<div class="flex items-center justify-between mb-3">
									<h2 class="text-lg font-semibold flex items-center gap-2" style="color: var(--text-primary);">
										<BookMarked class="w-5 h-5" style="color: var(--accent);" />
										Currently Reading
									</h2>
									<a href="/books?status=CURRENT" class="text-sm flex items-center gap-1 hover:underline" style="color: var(--accent);">
										View all
										<ChevronRight class="w-4 h-4" />
									</a>
								</div>
								<div class={showCompanion && hasCompanionData ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3'}>
									{#each data.continueReading.slice(0, showCompanion && hasCompanionData ? 3 : 6) as book}
										<BookCard
											{book}
											onClick={handleBookClick}
											showStatus={false}
											quickEdit={true}
											statuses={data.statuses}
											onQuickEdit={handleQuickEdit}
										/>
									{/each}
								</div>
							</section>
						{/if}

						<!-- Companion Section -->
						{#if showCompanion && hasCompanionData}
							{#if companionType === 'up-next-series' && hasUpNext}
								<section>
									<div class="flex items-center justify-between mb-3">
										<h2 class="text-lg font-semibold flex items-center gap-2" style="color: var(--text-primary);">
											<Hash class="w-5 h-5" style="color: var(--accent);" />
											Up Next in Series
										</h2>
										<a href="/series" class="text-sm flex items-center gap-1 hover:underline" style="color: var(--accent);">
											All series
											<ChevronRight class="w-4 h-4" />
										</a>
									</div>
									<div class="space-y-2">
										{#each data.upNextInSeries.slice(0, 3) as item}
											<a
												href="/books/{item.book.id}"
												class="card p-3 flex gap-3 hover:shadow-md transition-shadow group"
											>
												<div class="w-12 flex-shrink-0 rounded overflow-hidden aspect-[2/3]" style="background-color: var(--bg-tertiary);">
													<img
														src={item.book.coverImageUrl || '/placeholder.png'}
														alt={item.book.title}
														class="w-full h-full object-cover group-hover:scale-105 transition-transform"
														onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
													/>
												</div>
												<div class="flex-1 min-w-0">
													<p class="text-sm font-medium line-clamp-2 mb-1" style="color: var(--text-primary);">{item.book.title}</p>
													<p class="text-xs mb-1" style="color: var(--accent);">
														{item.seriesTitle}
														{#if item.bookNum} #{item.bookNum}{/if}
													</p>
													<div class="flex items-center gap-1 text-xs" style="color: var(--text-muted);">
														<CheckCircle2 class="w-3 h-3" />
														<span>{item.seriesProgress.read}/{item.seriesProgress.total} read</span>
													</div>
												</div>
											</a>
										{/each}
									</div>
								</section>
							{:else if companionType === 'smart-collection' && data.companionSmartCollectionData}
								<section>
									<div class="flex items-center justify-between mb-3">
										<h2 class="text-lg font-semibold flex items-center gap-2" style="color: var(--text-primary);">
											<Sparkles class="w-5 h-5" style="color: var(--accent);" />
											{data.companionSmartCollectionData.shelfName}
										</h2>
										{#if data.companionSmartCollectionData.shelfId}
											<a href="/shelves/{data.companionSmartCollectionData.shelfId}" class="text-sm flex items-center gap-1 hover:underline" style="color: var(--accent);">
												View all
												<ChevronRight class="w-4 h-4" />
											</a>
										{/if}
									</div>
									<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
										{#each data.companionSmartCollectionData.books.slice(0, 3) as book}
											<BookCard
												{book}
												onClick={handleBookClick}
												quickEdit={true}
												statuses={data.statuses}
												onQuickEdit={handleQuickEdit}
											/>
										{/each}
									</div>
								</section>
							{/if}
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Smart Collection (standalone, if enabled separately) -->
			{#if data.smartCollectionData && isSectionEnabled('smart-collection')}
				<SmartCollectionSection data={data.smartCollectionData} />
			{/if}

			<!-- Up Next in Series (standalone, when not used as companion) -->
			{#if data.upNextInSeries.length > 0 && isSectionEnabled('up-next-series')}
			{@const continueReadingSectionForUpNext = data.dashboardConfig?.sections.find(s => s.id === 'continue-reading')}
			{@const upNextAsCompanion = continueReadingSectionForUpNext?.companionSection === 'up-next-series' && continueReadingSectionForUpNext?.enabled && data.continueReading.length > 0}
			{#if !upNextAsCompanion}
				<section>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-lg font-semibold flex items-center gap-2" style="color: var(--text-primary);">
							<Hash class="w-5 h-5" style="color: var(--accent);" />
							Up Next in Series
						</h2>
						<a href="/series" class="text-sm flex items-center gap-1 hover:underline" style="color: var(--accent);">
							All series
							<ChevronRight class="w-4 h-4" />
						</a>
					</div>
					<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
						{#each data.upNextInSeries.slice(0, 6) as item}
							<a
								href="/books/{item.book.id}"
								class="card p-3 flex gap-3 hover:shadow-md transition-shadow group"
							>
								<div class="w-12 flex-shrink-0 rounded overflow-hidden aspect-[2/3]" style="background-color: var(--bg-tertiary);">
									<img
										src={item.book.coverImageUrl || '/placeholder.png'}
										alt={item.book.title}
										class="w-full h-full object-cover group-hover:scale-105 transition-transform"
										onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
									/>
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium line-clamp-2 mb-1" style="color: var(--text-primary);">{item.book.title}</p>
									<p class="text-xs mb-1" style="color: var(--accent);">
										{item.seriesTitle}
										{#if item.bookNum} #{item.bookNum}{/if}
									</p>
									<div class="flex items-center gap-1 text-xs" style="color: var(--text-muted);">
										<CheckCircle2 class="w-3 h-3" />
										<span>{item.seriesProgress.read}/{item.seriesProgress.total} read</span>
									</div>
								</div>
							</a>
						{/each}
					</div>
				</section>
			{/if}
			{/if}

			<!-- Recently Added -->
			{#if data.recentlyAdded.length > 0 && isSectionEnabled('recently-added')}
				<section>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-lg font-semibold flex items-center gap-2" style="color: var(--text-primary);">
							<Clock class="w-5 h-5" style="color: var(--accent);" />
							Recently Added
						</h2>
						<a href="/books?sort=createdAt&order=desc" class="text-sm flex items-center gap-1 hover:underline" style="color: var(--accent);">
							View all
							<ChevronRight class="w-4 h-4" />
						</a>
					</div>
					<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
						{#each data.recentlyAdded.slice(0, 12) as book}
							<BookCard
								{book}
								onClick={handleBookClick}
								quickEdit={true}
								statuses={data.statuses}
								onQuickEdit={handleQuickEdit}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Recently Completed -->
			{#if data.recentlyCompleted.length > 0 && isSectionEnabled('recently-completed')}
				<section>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-lg font-semibold flex items-center gap-2" style="color: var(--text-primary);">
							<CheckCircle2 class="w-5 h-5" style="color: var(--accent);" />
							Recently Completed
						</h2>
						<a href="/books?status=READ&sort=completedDate&order=desc" class="text-sm flex items-center gap-1 hover:underline" style="color: var(--accent);">
							View all
							<ChevronRight class="w-4 h-4" />
						</a>
					</div>
					<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
						{#each data.recentlyCompleted as book}
							<BookCard
								{book}
								onClick={handleBookClick}
								showStatus={false}
								quickEdit={true}
								statuses={data.statuses}
								onQuickEdit={handleQuickEdit}
							/>
						{/each}
					</div>
				</section>
			{/if}
		</div>

		<!-- Right Column (1/3) -->
		<div class="space-y-6">
			<!-- Monthly Reading Chart -->
			<section class="card p-4">
				<h3 class="text-sm font-semibold mb-3 flex items-center gap-2" style="color: var(--text-primary);">
					<BarChart3 class="w-4 h-4" style="color: var(--accent);" />
					Books Read This Year
				</h3>
				<div class="flex items-end gap-1" style="height: 96px;">
					{#each data.monthlyReading as month, i}
						{@const height = maxMonthlyCount > 0 ? (month.count / maxMonthlyCount) * 100 : 0}
						{@const isCurrentMonth = i === new Date().getMonth()}
						<div class="flex-1 flex flex-col items-center justify-end" style="height: 100%;">
							<div
								class="w-full rounded-t transition-all hover:opacity-80"
								style="height: {Math.max(height, 4)}%; min-height: 4px; background-color: {isCurrentMonth ? 'var(--accent)' : 'var(--border-color)'};"
								title="{month.month}: {month.count} books"
							></div>
						</div>
					{/each}
				</div>
				<div class="flex gap-1 mt-1">
					{#each data.monthlyReading as month, i}
						<div class="flex-1 text-center">
							<span class="text-[10px]" style="color: var(--text-muted);">{month.shortMonth}</span>
						</div>
					{/each}
				</div>
				<div class="text-center mt-2">
					<span class="text-xs" style="color: var(--text-muted);">
						Total: {data.monthlyReading.reduce((sum, m) => sum + m.count, 0)} books
					</span>
				</div>
			</section>

			<!-- Format Breakdown -->
			{#if data.formatBreakdown.length > 0}
				<section class="card p-4">
					<h3 class="text-sm font-semibold mb-3 flex items-center gap-2" style="color: var(--text-primary);">
						<PieChart class="w-4 h-4" style="color: var(--accent);" />
						Format Breakdown
					</h3>
					<div class="space-y-2">
						{#each data.formatBreakdown as format}
							<div class="flex items-center gap-2">
								<div
									class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
									style="background-color: {format.color || 'var(--bg-tertiary)'};"
								>
									{#if format.icon}
										<LucideIcon name={format.icon} size={14} color="white" />
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex justify-between text-xs mb-0.5">
										<span style="color: var(--text-primary);">{format.name}</span>
										<span style="color: var(--text-muted);">{format.count}</span>
									</div>
									<div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--border-color);">
										<div
											class="h-full rounded-full"
											style="width: {format.percentage}%; background-color: {format.color || 'var(--accent)'};"
										></div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Genre Distribution -->
			{#if data.genreDistribution.length > 0}
				<section class="card p-4">
					<h3 class="text-sm font-semibold mb-3 flex items-center gap-2" style="color: var(--text-primary);">
						<Layers class="w-4 h-4" style="color: var(--accent);" />
						Top Genres
					</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each data.genreDistribution as genre}
							<a
								href="/books?genre={genre.id}"
								class="px-2 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80"
								style="background-color: {genre.color || 'var(--bg-tertiary)'}; color: {genre.color ? 'white' : 'var(--text-secondary)'};"
							>
								{genre.name} ({genre.count})
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Top Authors -->
			{#if data.topAuthors.length > 0}
				<section class="card p-4">
					<h3 class="text-sm font-semibold mb-3 flex items-center gap-2" style="color: var(--text-primary);">
						<Users class="w-4 h-4" style="color: var(--accent);" />
						Top Authors
					</h3>
					<div class="space-y-2">
						{#each data.topAuthors as author}
							<a
								href="/authors/{author.id}"
								class="flex items-center gap-2 p-2 rounded hover:bg-opacity-50 transition-colors"
								style="background-color: var(--bg-tertiary);"
							>
								{#if author.photoUrl}
									<img src={author.photoUrl} alt={author.name} class="w-8 h-8 rounded-full object-cover" />
								{:else}
									<div class="w-8 h-8 rounded-full flex items-center justify-center" style="background-color: var(--border-color);">
										<Users class="w-4 h-4" style="color: var(--text-muted);" />
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<p class="text-sm truncate" style="color: var(--text-primary);">{author.name}</p>
									<p class="text-xs" style="color: var(--text-muted);">
										{author.bookCount} books · {author.readCount} read
									</p>
								</div>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Top Narrators -->
			{#if data.topNarrators && data.topNarrators.length > 0}
				<section class="card p-4">
					<h3 class="text-sm font-semibold mb-3 flex items-center gap-2" style="color: var(--text-primary);">
						<Mic2 class="w-4 h-4" style="color: var(--accent);" />
						Top Narrators
					</h3>
					<div class="space-y-2">
						{#each data.topNarrators as narrator}
							<a
								href="/narrators/{narrator.id}"
								class="flex items-center gap-2 p-2 rounded hover:bg-opacity-50 transition-colors"
								style="background-color: var(--bg-tertiary);"
							>
								{#if narrator.photoUrl}
									<img src={narrator.photoUrl} alt={narrator.name} class="w-8 h-8 rounded-full object-cover" />
								{:else}
									<div class="w-8 h-8 rounded-full flex items-center justify-center" style="background-color: var(--border-color);">
										<Mic2 class="w-4 h-4" style="color: var(--text-muted);" />
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<p class="text-sm truncate" style="color: var(--text-primary);">{narrator.name}</p>
									<p class="text-xs" style="color: var(--text-muted);">
										{narrator.audiobookCount} audiobooks · {narrator.listenedCount} listened
									</p>
								</div>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Highest Rated Book -->
			{#if data.highestRatedBook}
				<section class="card p-4">
					<h3 class="text-sm font-semibold mb-3 flex items-center gap-2" style="color: var(--text-primary);">
						<Trophy class="w-4 h-4" style="color: #eab308;" />
						Highest Rated
					</h3>
					<a
						href="/books/{data.highestRatedBook.id}"
						class="block group"
					>
						<div class="flex gap-3">
							<div class="w-12 h-16 flex-shrink-0 rounded overflow-hidden" style="background-color: var(--bg-tertiary);">
								<img
									src={data.highestRatedBook.coverImageUrl || '/placeholder.png'}
									alt={data.highestRatedBook.title}
									class="w-full h-full object-cover group-hover:scale-105 transition-transform"
								/>
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium line-clamp-2 mb-1 group-hover:underline" style="color: var(--text-primary);">
									{data.highestRatedBook.title}
								</p>
								{#if data.highestRatedBook.authorName}
									<p class="text-xs mb-1" style="color: var(--text-secondary);">{data.highestRatedBook.authorName}</p>
								{/if}
								{#if data.highestRatedBook.rating}
								<div class="flex items-center gap-1">
									<Star class="w-3 h-3 fill-yellow-400 text-yellow-400" />
									<span class="text-xs font-medium" style="color: var(--text-primary);">{data.highestRatedBook.rating.toFixed(1)}</span>
								</div>
							{/if}
							</div>
						</div>
					</a>
				</section>
			{/if}

			<!-- Random TBR Pick -->
			{#if data.randomTbrPick}
				<section class="card p-4">
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-sm font-semibold flex items-center gap-2" style="color: var(--text-primary);">
							<Shuffle class="w-4 h-4" style="color: var(--accent);" />
							Random TBR Pick
						</h3>
						<button
							type="button"
							class="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
							style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
							onclick={refreshRandomPick}
						>
							Shuffle
						</button>
					</div>
					<a
						href="/books/{data.randomTbrPick.id}"
						class="block group"
					>
						<div class="flex gap-3">
							<div class="w-16 h-24 flex-shrink-0 rounded overflow-hidden" style="background-color: var(--bg-tertiary);">
								<img
									src={data.randomTbrPick.coverImageUrl || '/placeholder.png'}
									alt={data.randomTbrPick.title}
									class="w-full h-full object-cover group-hover:scale-105 transition-transform"
								/>
							</div>
							<div class="flex-1 min-w-0">
								<p class="font-medium line-clamp-2 mb-1 group-hover:underline" style="color: var(--text-primary);">
									{data.randomTbrPick.title}
								</p>
								{#if data.randomTbrPick.authorName}
									<p class="text-sm mb-1" style="color: var(--text-secondary);">{data.randomTbrPick.authorName}</p>
								{/if}
								{#if data.randomTbrPick.seriesName}
									<p class="text-xs" style="color: var(--accent);">
										{data.randomTbrPick.seriesName}
										{#if data.randomTbrPick.bookNum} #{data.randomTbrPick.bookNum}{/if}
									</p>
								{/if}
							</div>
						</div>
					</a>
				</section>
			{/if}
		</div>
	</div>
</div>

<!-- Dashboard Settings Modal -->
<DashboardSettingsModal
	open={showSettingsModal}
	config={data.dashboardConfig}
	magicShelves={data.magicShelves}
	onClose={() => showSettingsModal = false}
	onSave={saveDashboardConfig}
/>

<style>
	/* Primary stat cards (larger) */
	.stat-card-lg {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		border-radius: 0.75rem;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
	}

	.stat-icon-lg {
		width: 3rem;
		height: 3rem;
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.stat-content-lg {
		min-width: 0;
	}

	.stat-value-lg {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.stat-label-lg {
		font-size: 0.8125rem;
		color: var(--text-muted);
		margin-top: 0.125rem;
	}

	/* Secondary stat cards (smaller, compact row) */
	.stat-card-sm {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		border-radius: 0.5rem;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
	}

	.stat-value-sm {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.stat-label-sm {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.stat-card-lg {
			flex-direction: column;
			text-align: center;
			gap: 0.5rem;
			padding: 1rem;
		}

		.stat-icon-lg {
			width: 2.5rem;
			height: 2.5rem;
		}

		.stat-value-lg {
			font-size: 1.5rem;
		}

		.stat-label-lg {
			font-size: 0.75rem;
		}

		.stat-card-sm {
			flex-direction: column;
			text-align: center;
			gap: 0.25rem;
			padding: 0.5rem;
		}

		.stat-value-sm {
			font-size: 0.875rem;
		}

		.stat-label-sm {
			font-size: 0.625rem;
		}
	}
</style>
