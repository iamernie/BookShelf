<script lang="ts">
	import {
		BookOpen,
		Users,
		Library,
		Tag,
		Star,
		Calendar,
		Award,
		Mic,
		BarChart2,
		PieChart,
		ChevronLeft,
		ChevronRight,
		Clock,
		Target,
		TrendingUp
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import ReadingHeatmap from '$lib/components/stats/ReadingHeatmap.svelte';

	let { data } = $props();
	const stats = data.stats;

	// Timeline state
	let selectedYear = $state(stats.currentYear);
	let timelineData = $state(data.timeline);
	let isLoadingTimeline = $state(false);

	// Month names for chart
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	// Calculate max for scaling charts
	const maxMonthly = Math.max(...stats.monthlyData, 1);
	const maxRating = Math.max(...stats.ratingData, 1);
	const maxAuthorCount = stats.topAuthorsData.length > 0 ? Math.max(...stats.topAuthorsData.map(a => a.count), 1) : 1;

	// Year navigation
	async function changeYear(delta: number) {
		const newYear = selectedYear + delta;
		if (newYear > new Date().getFullYear() || newYear < (timelineData.yearsWithBooks[timelineData.yearsWithBooks.length - 1] || 2020)) {
			return;
		}
		isLoadingTimeline = true;
		selectedYear = newYear;

		try {
			const response = await fetch(`/api/stats/timeline?year=${newYear}`);
			if (response.ok) {
				timelineData = await response.json();
			}
		} catch (e) {
			console.error('Failed to load timeline', e);
		} finally {
			isLoadingTimeline = false;
		}
	}
</script>

<svelte:head>
	<title>Statistics - BookShelf</title>
</svelte:head>

<div class="p-6 max-w-7xl mx-auto">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Statistics</h1>
		<p class="mt-1" style="color: var(--text-muted);">Your reading stats and insights</p>
	</div>

	<!-- Quick Stats Grid - Now Clickable -->
	<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
		<!-- Total Books -->
		<a href="/books" class="stat-card clickable">
			<div class="stat-icon" style="background-color: rgba(59, 130, 246, 0.1);">
				<BookOpen class="w-5 h-5" style="color: #3b82f6;" />
			</div>
			<div class="stat-value">{stats.totalBooks}</div>
			<div class="stat-label">Total Books</div>
		</a>

		<!-- Books Read -->
		<a href="/books?status=read" class="stat-card clickable">
			<div class="stat-icon" style="background-color: rgba(34, 197, 94, 0.1);">
				<Award class="w-5 h-5" style="color: #22c55e;" />
			</div>
			<div class="stat-value">{stats.readBooks}</div>
			<div class="stat-label">Books Read</div>
		</a>

		<!-- This Year -->
		<a href="/books?status=read&year={stats.currentYear}" class="stat-card clickable">
			<div class="stat-icon" style="background-color: rgba(168, 85, 247, 0.1);">
				<Calendar class="w-5 h-5" style="color: #a855f7;" />
			</div>
			<div class="stat-value">{stats.booksReadThisYear}</div>
			<div class="stat-label">Read in {stats.currentYear}</div>
		</a>

		<!-- Authors -->
		<a href="/authors" class="stat-card clickable">
			<div class="stat-icon" style="background-color: rgba(249, 115, 22, 0.1);">
				<Users class="w-5 h-5" style="color: #f97316;" />
			</div>
			<div class="stat-value">{stats.totalAuthors}</div>
			<div class="stat-label">Authors</div>
		</a>

		<!-- Series -->
		<a href="/series" class="stat-card clickable">
			<div class="stat-icon" style="background-color: rgba(236, 72, 153, 0.1);">
				<Library class="w-5 h-5" style="color: #ec4899;" />
			</div>
			<div class="stat-value">{stats.totalSeries}</div>
			<div class="stat-label">Series</div>
		</a>

		<!-- Avg Rating -->
		<div class="stat-card">
			<div class="stat-icon" style="background-color: rgba(234, 179, 8, 0.1);">
				<Star class="w-5 h-5" style="color: #eab308;" />
			</div>
			<div class="stat-value">{stats.avgRating ?? 'N/A'}</div>
			<div class="stat-label">Avg Rating</div>
		</div>
	</div>

	<!-- Reading Goals Card (placeholder for future feature) -->
	<div class="mb-6">
		<a href="/stats/goals" class="block feature-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
			<div class="flex items-center gap-4">
				<div class="flex-shrink-0">
					<Target class="w-12 h-12 text-white opacity-80" />
				</div>
				<div class="flex-1">
					<h3 class="text-lg font-bold text-white">Reading Goals</h3>
					<p class="text-white/80 text-sm">Set and track your reading goals for {stats.currentYear}</p>
				</div>
				<div class="flex-shrink-0">
					<ChevronRight class="w-6 h-6 text-white/70" />
				</div>
			</div>
		</a>
	</div>

	<!-- Reading Activity Heatmap -->
	<div class="mb-6">
		<div class="chart-card">
			<div class="chart-header">
				<div class="flex items-center gap-2">
					<Calendar class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="font-semibold" style="color: var(--text-primary);">Reading Activity</h2>
				</div>
			</div>
			<div class="chart-body">
				<ReadingHeatmap initialYear={stats.currentYear} />
			</div>
		</div>
	</div>

	<!-- Charts Row 1 -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
		<!-- Monthly Reading Chart -->
		<div class="chart-card">
			<div class="chart-header">
				<div class="flex items-center gap-2">
					<BarChart2 class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="font-semibold" style="color: var(--text-primary);">Books Read by Month ({stats.currentYear})</h2>
				</div>
			</div>
			<div class="chart-body">
				<div class="flex items-end justify-between h-48 gap-1">
					{#each stats.monthlyData as count, i}
						<div class="flex flex-col items-center flex-1">
							<div
								class="w-full rounded-t transition-all hover:opacity-80 cursor-pointer"
								style="height: {(count / maxMonthly) * 100}%; min-height: {count > 0 ? '4px' : '0'}; background-color: var(--accent);"
								title="{monthNames[i]}: {count} books"
							></div>
							<span class="text-xs mt-2" style="color: var(--text-muted);">{monthNames[i]}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Status Distribution -->
		<div class="chart-card">
			<div class="chart-header">
				<div class="flex items-center gap-2">
					<PieChart class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="font-semibold" style="color: var(--text-primary);">By Status</h2>
				</div>
			</div>
			<div class="chart-body">
				{#if stats.statusData.length > 0}
					<div class="space-y-3">
						{#each stats.statusData as status}
							{@const percentage = stats.totalBooks > 0 ? (status.count / stats.totalBooks) * 100 : 0}
							<a href="/books?status={status.name.toLowerCase().replace(' ', '_')}" class="block hover:opacity-80 transition-opacity">
								<div class="flex justify-between mb-1">
									<span class="text-sm" style="color: var(--text-primary);">{status.name}</span>
									<span class="text-sm" style="color: var(--text-muted);">{status.count} ({percentage.toFixed(0)}%)</span>
								</div>
								<div class="h-2 rounded-full" style="background-color: var(--bg-tertiary);">
									<div
										class="h-full rounded-full transition-all"
										style="width: {percentage}%; background-color: {status.color};"
									></div>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<div class="flex items-center justify-center h-48" style="color: var(--text-muted);">
						No status data available
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Charts Row 2 -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
		<!-- Rating Distribution -->
		<div class="chart-card">
			<div class="chart-header">
				<div class="flex items-center gap-2">
					<Star class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="font-semibold" style="color: var(--text-primary);">Rating Distribution</h2>
				</div>
			</div>
			<div class="chart-body">
				<div class="space-y-2">
					{#each [5, 4, 3, 2, 1] as rating}
						{@const count = stats.ratingData[rating - 1]}
						<a href="/books?rating={rating}" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
							<div class="flex items-center gap-1 w-16">
								<Star class="w-4 h-4" style="color: #eab308;" />
								<span class="text-sm" style="color: var(--text-primary);">{rating}</span>
							</div>
							<div class="flex-1 h-5 rounded" style="background-color: var(--bg-tertiary);">
								<div
									class="h-full rounded transition-all"
									style="width: {(count / maxRating) * 100}%; background-color: #eab308;"
								></div>
							</div>
							<span class="w-8 text-right text-sm" style="color: var(--text-muted);">{count}</span>
						</a>
					{/each}
				</div>
			</div>
		</div>

		<!-- Top Authors -->
		<div class="chart-card">
			<div class="chart-header">
				<div class="flex items-center gap-2">
					<Users class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="font-semibold" style="color: var(--text-primary);">Top Authors</h2>
				</div>
			</div>
			<div class="chart-body">
				{#if stats.topAuthorsData.length > 0}
					<div class="space-y-3">
						{#each stats.topAuthorsData as author, i}
							<a href="/authors/{author.id}" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
								<span class="w-5 text-sm font-medium" style="color: var(--text-muted);">#{i + 1}</span>
								<div class="flex-1">
									<div class="text-sm truncate" style="color: var(--text-primary);" title={author.name}>
										{author.name}
									</div>
									<div class="h-1.5 mt-1 rounded-full" style="background-color: var(--bg-tertiary);">
										<div
											class="h-full rounded-full"
											style="width: {(author.count / maxAuthorCount) * 100}%; background-color: var(--accent);"
										></div>
									</div>
								</div>
								<span class="text-sm" style="color: var(--text-muted);">{author.count}</span>
							</a>
						{/each}
					</div>
				{:else}
					<div class="flex items-center justify-center h-32" style="color: var(--text-muted);">
						No author data available
					</div>
				{/if}
			</div>
		</div>

		<!-- Genre Distribution -->
		<div class="chart-card">
			<div class="chart-header">
				<div class="flex items-center gap-2">
					<Tag class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="font-semibold" style="color: var(--text-primary);">Top Genres</h2>
				</div>
			</div>
			<div class="chart-body">
				{#if stats.genreData.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each stats.genreData as genre}
							<a
								href="/books?genre={genre.id}"
								class="px-3 py-2 rounded-lg text-sm hover:scale-105 transition-transform"
								style="background-color: {genre.color}20; border: 1px solid {genre.color}40;"
							>
								<span style="color: {genre.color};">{genre.name}</span>
								<span class="ml-1 opacity-70">({genre.count})</span>
							</a>
						{/each}
					</div>
				{:else}
					<div class="flex items-center justify-center h-32" style="color: var(--text-muted);">
						No genre data available
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Reading Timeline Section -->
	<div class="chart-card mb-6">
		<div class="chart-header">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Clock class="w-5 h-5" style="color: var(--accent);" />
					<h2 class="font-semibold" style="color: var(--text-primary);">Reading Timeline</h2>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={() => changeYear(-1)}
						class="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
						disabled={isLoadingTimeline || selectedYear <= (timelineData.yearsWithBooks[timelineData.yearsWithBooks.length - 1] || 2020)}
						style="color: var(--text-primary);"
					>
						<ChevronLeft class="w-5 h-5" />
					</button>
					<span class="font-medium min-w-[4rem] text-center" style="color: var(--text-primary);">{selectedYear}</span>
					<button
						onclick={() => changeYear(1)}
						class="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
						disabled={isLoadingTimeline || selectedYear >= new Date().getFullYear()}
						style="color: var(--text-primary);"
					>
						<ChevronRight class="w-5 h-5" />
					</button>
				</div>
			</div>
		</div>
		<div class="p-4">
			<!-- Year Summary -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 rounded-lg" style="background-color: var(--bg-tertiary);">
				<div class="text-center">
					<div class="text-2xl font-bold" style="color: var(--text-primary);">{timelineData.yearStats.totalBooks}</div>
					<div class="text-xs" style="color: var(--text-muted);">Books Read</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold" style="color: var(--text-primary);">{timelineData.yearStats.totalPages.toLocaleString()}</div>
					<div class="text-xs" style="color: var(--text-muted);">Pages</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold" style="color: var(--text-primary);">{timelineData.yearStats.avgRating}</div>
					<div class="text-xs" style="color: var(--text-muted);">Avg Rating</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold" style="color: var(--text-primary);">{timelineData.yearStats.bestMonth}</div>
					<div class="text-xs" style="color: var(--text-muted);">Best Month</div>
				</div>
			</div>

			<!-- Monthly Timeline -->
			{#if isLoadingTimeline}
				<div class="flex items-center justify-center py-12" style="color: var(--text-muted);">
					Loading...
				</div>
			{:else}
				<div class="space-y-4">
					{#each timelineData.timelineData as month}
						{#if month.count > 0}
							<div class="timeline-month">
								<div class="flex items-center gap-3 mb-3">
									<div class="w-24 font-medium" style="color: var(--text-primary);">{month.name}</div>
									<div class="flex-1 h-px" style="background-color: var(--border-color);"></div>
									<div class="text-sm font-medium px-2 py-0.5 rounded" style="background-color: var(--accent); color: white;">
										{month.count} {month.count === 1 ? 'book' : 'books'}
									</div>
								</div>
								<div class="flex gap-3 overflow-x-auto pb-2">
									{#each month.books as book}
										<a href="/books/{book.id}" class="flex-shrink-0 group">
											<div class="w-16 h-24 rounded overflow-hidden shadow-sm group-hover:shadow-md transition-shadow" style="background-color: var(--bg-tertiary);">
												<img
													src={book.coverImageUrl || '/placeholder.png'}
													alt={book.title}
													class="w-full h-full object-cover"
													onerror={(e) => {
														(e.target as HTMLImageElement).src = '/placeholder.png';
													}}
												/>
											</div>
											<div class="mt-1 w-16">
												<div class="text-xs truncate" style="color: var(--text-primary);" title={book.title}>
													{book.title}
												</div>
												{#if book.rating}
													<div class="flex items-center gap-0.5">
														<Star class="w-3 h-3" style="color: #eab308;" />
														<span class="text-xs" style="color: var(--text-muted);">{book.rating}</span>
													</div>
												{/if}
											</div>
										</a>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
					{#if timelineData.yearStats.totalBooks === 0}
						<div class="text-center py-8" style="color: var(--text-muted);">
							No books completed in {selectedYear}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Highlights Row -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
		<!-- Latest Read -->
		{#if stats.latestReadBook}
			<a href="/books/{stats.latestReadBook.id}" class="highlight-card hover:shadow-lg transition-shadow">
				<div class="text-xs uppercase tracking-wide mb-3" style="color: var(--text-muted);">Latest Read</div>
				<div class="flex gap-3">
					<img
						src={stats.latestReadBook.coverImageUrl || '/placeholder.png'}
						alt={stats.latestReadBook.title}
						class="w-12 h-16 object-cover rounded"
						style="background-color: var(--bg-tertiary);"
						onerror={(e) => {
							(e.target as HTMLImageElement).src = '/placeholder.png';
						}}
					/>
					<div class="flex-1 min-w-0">
						<div class="font-medium truncate" style="color: var(--text-primary);">
							{stats.latestReadBook.title}
						</div>
						{#if stats.latestReadBook.author}
							<div class="text-sm truncate" style="color: var(--text-muted);">{stats.latestReadBook.author}</div>
						{/if}
						{#if stats.latestReadBook.completedDate}
							<div class="text-xs mt-1" style="color: var(--text-muted);">
								{formatDate(stats.latestReadBook.completedDate)}
							</div>
						{/if}
					</div>
				</div>
			</a>
		{/if}

		<!-- Most Read Author -->
		{#if stats.popularAuthor}
			<a href="/authors/{stats.popularAuthor.id}" class="highlight-card hover:shadow-lg transition-shadow">
				<div class="text-xs uppercase tracking-wide mb-3" style="color: var(--text-muted);">Favorite Author</div>
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background-color: rgba(249, 115, 22, 0.1);">
						<Users class="w-6 h-6" style="color: #f97316;" />
					</div>
					<div>
						<div class="font-medium" style="color: var(--text-primary);">
							{stats.popularAuthor.name}
						</div>
						<div class="text-sm" style="color: var(--text-muted);">{stats.popularAuthor.bookCount} books</div>
					</div>
				</div>
			</a>
		{/if}

		<!-- Most Used Tag -->
		{#if stats.popularTag}
			<a href="/books?tag={stats.popularTag.id}" class="highlight-card hover:shadow-lg transition-shadow">
				<div class="text-xs uppercase tracking-wide mb-3" style="color: var(--text-muted);">Top Tag</div>
				<div class="flex items-center gap-3">
					<div
						class="w-12 h-12 rounded-full flex items-center justify-center"
						style="background-color: {stats.popularTag.color || 'var(--accent)'}20;"
					>
						<Tag class="w-6 h-6" style="color: {stats.popularTag.color || 'var(--accent)'};" />
					</div>
					<div>
						<div class="font-medium" style="color: var(--text-primary);">
							{stats.popularTag.name}
						</div>
						<div class="text-sm" style="color: var(--text-muted);">{stats.popularTag.bookCount} books</div>
					</div>
				</div>
			</a>
		{/if}

		<!-- Favorite Narrator (if exists) -->
		{#if stats.popularNarrator}
			<a href="/narrators/{stats.popularNarrator.id}" class="highlight-card hover:shadow-lg transition-shadow">
				<div class="text-xs uppercase tracking-wide mb-3" style="color: var(--text-muted);">Top Narrator</div>
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background-color: rgba(168, 85, 247, 0.1);">
						<Mic class="w-6 h-6" style="color: #a855f7;" />
					</div>
					<div>
						<div class="font-medium" style="color: var(--text-primary);">
							{stats.popularNarrator.name}
						</div>
						<div class="text-sm" style="color: var(--text-muted);">{stats.popularNarrator.bookCount} books</div>
					</div>
				</div>
			</a>
		{/if}
	</div>

	<!-- Completion Progress -->
	<div class="p-4 rounded-lg" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
		<div class="flex items-center justify-between mb-2">
			<span class="text-sm font-medium" style="color: var(--text-primary);">Library Completion</span>
			<span class="text-sm" style="color: var(--text-muted);">{stats.readBooks} of {stats.totalBooks} books ({stats.completionPercentage}%)</span>
		</div>
		<div class="h-3 rounded-full overflow-hidden" style="background-color: var(--bg-tertiary);">
			<div
				class="h-full rounded-full transition-all"
				style="width: {stats.completionPercentage}%; background: linear-gradient(90deg, var(--accent), #22c55e);"
			></div>
		</div>
	</div>
</div>

<style>
	.stat-card {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.stat-card.clickable:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.stat-icon {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.5rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.chart-card {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.chart-header {
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.chart-body {
		padding: 1rem;
	}

	.highlight-card {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		padding: 1rem;
		text-decoration: none;
		display: block;
	}

	.feature-card {
		border-radius: 0.75rem;
		padding: 1.25rem;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.feature-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.timeline-month {
		padding: 0.5rem 0;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
