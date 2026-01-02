<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronLeft, ChevronRight, Flame, BookOpen, Clock } from 'lucide-svelte';

	interface DayActivity {
		date: string;
		totalMinutes: number;
		sessionCount: number;
		booksRead: number[];
	}

	interface HeatmapData {
		days: DayActivity[];
		totalMinutes: number;
		totalSessions: number;
		longestStreak: number;
		currentStreak: number;
	}

	interface Props {
		initialYear?: number;
	}

	let { initialYear = new Date().getFullYear() }: Props = $props();

	let year = $state(initialYear);
	let loading = $state(true);
	let heatmapData = $state<HeatmapData | null>(null);
	let hoveredDay = $state<DayActivity | null>(null);
	let tooltipPosition = $state({ x: 0, y: 0 });

	// Generate calendar grid
	let calendarWeeks = $derived(generateCalendarWeeks(year, heatmapData?.days || []));

	const monthNames = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Fetch heatmap data
	async function fetchData() {
		loading = true;
		try {
			const res = await fetch(`/api/reading-sessions?type=heatmap&year=${year}`);
			heatmapData = await res.json();
		} catch (err) {
			console.error('Failed to fetch heatmap data:', err);
		}
		loading = false;
	}

	// Generate week-based calendar grid for the year
	function generateCalendarWeeks(
		year: number,
		days: DayActivity[]
	): Array<Array<{ date: string; activity: DayActivity | null; isCurrentMonth: boolean }>> {
		const dayMap = new Map(days.map((d) => [d.date, d]));
		const weeks: Array<
			Array<{ date: string; activity: DayActivity | null; isCurrentMonth: boolean }>
		> = [];

		// Start from Jan 1 of the year
		const startDate = new Date(year, 0, 1);
		// Go back to the Sunday of that week
		const startDay = startDate.getDay();
		startDate.setDate(startDate.getDate() - startDay);

		// End at Dec 31 of the year
		const endDate = new Date(year, 11, 31);
		// Go forward to the Saturday of that week
		const endDay = endDate.getDay();
		endDate.setDate(endDate.getDate() + (6 - endDay));

		let currentDate = new Date(startDate);
		let currentWeek: Array<{ date: string; activity: DayActivity | null; isCurrentMonth: boolean }> =
			[];

		while (currentDate <= endDate) {
			const dateStr = currentDate.toISOString().split('T')[0];
			const isCurrentYear = currentDate.getFullYear() === year;

			currentWeek.push({
				date: dateStr,
				activity: isCurrentYear ? (dayMap.get(dateStr) || null) : null,
				isCurrentMonth: isCurrentYear
			});

			if (currentWeek.length === 7) {
				weeks.push(currentWeek);
				currentWeek = [];
			}

			currentDate.setDate(currentDate.getDate() + 1);
		}

		if (currentWeek.length > 0) {
			weeks.push(currentWeek);
		}

		return weeks;
	}

	// Get color intensity based on reading minutes
	function getIntensityClass(minutes: number | undefined): string {
		if (!minutes || minutes === 0) return 'level-0';
		if (minutes < 15) return 'level-1';
		if (minutes < 30) return 'level-2';
		if (minutes < 60) return 'level-3';
		return 'level-4';
	}

	// Format minutes for display
	function formatMinutes(minutes: number): string {
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	// Handle day hover
	function handleDayHover(day: DayActivity | null, event: MouseEvent) {
		if (day && day.totalMinutes > 0) {
			hoveredDay = day;
			const rect = (event.target as HTMLElement).getBoundingClientRect();
			tooltipPosition = {
				x: rect.left + rect.width / 2,
				y: rect.top - 10
			};
		} else {
			hoveredDay = null;
		}
	}

	// Navigate years
	function prevYear() {
		year--;
		fetchData();
	}

	function nextYear() {
		year++;
		fetchData();
	}

	// Get month label positions for the header
	function getMonthLabels(): Array<{ month: string; weekIndex: number }> {
		const labels: Array<{ month: string; weekIndex: number }> = [];
		let lastMonth = -1;

		calendarWeeks.forEach((week, weekIndex) => {
			// Find first day of year in this week
			const yearDay = week.find((d) => d.isCurrentMonth);
			if (yearDay) {
				const month = new Date(yearDay.date).getMonth();
				if (month !== lastMonth) {
					labels.push({ month: monthNames[month], weekIndex });
					lastMonth = month;
				}
			}
		});

		return labels;
	}

	let monthLabels = $derived(getMonthLabels());

	onMount(() => {
		fetchData();
	});

	$effect(() => {
		// Refetch when year changes (for direct navigation)
		if (year) {
			fetchData();
		}
	});
</script>

<div class="heatmap-container">
	<!-- Header with year navigation and stats -->
	<div class="heatmap-header">
		<div class="year-nav">
			<button class="nav-btn" onclick={prevYear} title="Previous year">
				<ChevronLeft class="w-5 h-5" />
			</button>
			<span class="year-label">{year}</span>
			<button
				class="nav-btn"
				onclick={nextYear}
				disabled={year >= new Date().getFullYear()}
				title="Next year"
			>
				<ChevronRight class="w-5 h-5" />
			</button>
		</div>

		{#if heatmapData}
			<div class="stats-row">
				<div class="stat">
					<Clock class="w-4 h-4" />
					<span>{formatMinutes(heatmapData.totalMinutes)} read</span>
				</div>
				<div class="stat">
					<BookOpen class="w-4 h-4" />
					<span>{heatmapData.totalSessions} sessions</span>
				</div>
				<div class="stat">
					<Flame class="w-4 h-4" />
					<span>{heatmapData.currentStreak} day streak</span>
				</div>
				<div class="stat">
					<span class="text-xs opacity-70">Best: {heatmapData.longestStreak} days</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Heatmap grid -->
	<div class="heatmap-scroll">
		{#if loading}
			<div class="loading-state">Loading reading activity...</div>
		{:else}
			<div class="heatmap-grid">
				<!-- Month labels -->
				<div class="month-labels">
					<div class="day-label-spacer"></div>
					{#each monthLabels as label}
						<div class="month-label" style="grid-column: {label.weekIndex + 2}">
							{label.month}
						</div>
					{/each}
				</div>

				<!-- Day labels + Grid -->
				<div class="grid-with-labels">
					<!-- Day labels (only show Mon, Wed, Fri) -->
					<div class="day-labels">
						<div class="day-label"></div>
						<div class="day-label">Mon</div>
						<div class="day-label"></div>
						<div class="day-label">Wed</div>
						<div class="day-label"></div>
						<div class="day-label">Fri</div>
						<div class="day-label"></div>
					</div>

					<!-- Calendar grid -->
					<div class="calendar-grid">
						{#each calendarWeeks as week, weekIndex}
							<div class="week-column">
								{#each week as day}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="day-cell {getIntensityClass(day.activity?.totalMinutes)} {day.isCurrentMonth ? '' : 'outside-year'}"
										onmouseenter={(e) => handleDayHover(day.activity, e)}
										onmouseleave={() => (hoveredDay = null)}
									></div>
								{/each}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Legend -->
	<div class="heatmap-legend">
		<span class="legend-label">Less</span>
		<div class="legend-cells">
			<div class="legend-cell level-0"></div>
			<div class="legend-cell level-1"></div>
			<div class="legend-cell level-2"></div>
			<div class="legend-cell level-3"></div>
			<div class="legend-cell level-4"></div>
		</div>
		<span class="legend-label">More</span>
	</div>

	<!-- Tooltip -->
	{#if hoveredDay}
		<div
			class="tooltip"
			style="left: {tooltipPosition.x}px; top: {tooltipPosition.y}px"
		>
			<div class="tooltip-date">
				{new Date(hoveredDay.date).toLocaleDateString('en-US', {
					weekday: 'short',
					month: 'short',
					day: 'numeric'
				})}
			</div>
			<div class="tooltip-stats">
				{formatMinutes(hoveredDay.totalMinutes)} reading
				{#if hoveredDay.sessionCount > 1}
					<span class="text-xs opacity-70">({hoveredDay.sessionCount} sessions)</span>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.heatmap-container {
		position: relative;
		padding: 1rem;
		border-radius: 0.5rem;
		background: var(--bg-secondary, #f8f9fa);
	}

	.heatmap-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.year-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.nav-btn {
		padding: 0.25rem;
		border: 1px solid var(--border-color, #dee2e6);
		border-radius: 0.25rem;
		background: var(--bg-primary, white);
		color: var(--text-primary, #1a1a1a);
		cursor: pointer;
		transition: all 0.2s;
	}

	.nav-btn:hover:not(:disabled) {
		background: var(--bg-tertiary, #e9ecef);
	}

	.nav-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.year-label {
		font-size: 1.25rem;
		font-weight: 600;
		min-width: 60px;
		text-align: center;
	}

	.stats-row {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--text-secondary, #6c757d);
	}

	.heatmap-scroll {
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.loading-state {
		padding: 2rem;
		text-align: center;
		color: var(--text-muted, #adb5bd);
	}

	.heatmap-grid {
		min-width: 800px;
	}

	.month-labels {
		display: grid;
		grid-template-columns: 30px repeat(53, 12px);
		gap: 2px;
		margin-bottom: 4px;
		font-size: 0.75rem;
		color: var(--text-muted, #6c757d);
	}

	.day-label-spacer {
		width: 30px;
	}

	.month-label {
		white-space: nowrap;
	}

	.grid-with-labels {
		display: flex;
		gap: 4px;
	}

	.day-labels {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.65rem;
		color: var(--text-muted, #6c757d);
		width: 26px;
	}

	.day-label {
		height: 12px;
		display: flex;
		align-items: center;
	}

	.calendar-grid {
		display: flex;
		gap: 2px;
	}

	.week-column {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.day-cell {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.1s;
	}

	.day-cell:hover {
		transform: scale(1.2);
	}

	.day-cell.outside-year {
		visibility: hidden;
	}

	/* Intensity levels - green theme like GitHub */
	.level-0 {
		background: var(--heatmap-0, #ebedf0);
	}
	.level-1 {
		background: var(--heatmap-1, #9be9a8);
	}
	.level-2 {
		background: var(--heatmap-2, #40c463);
	}
	.level-3 {
		background: var(--heatmap-3, #30a14e);
	}
	.level-4 {
		background: var(--heatmap-4, #216e39);
	}

	/* Dark mode overrides */
	:global([data-theme='dark']) .level-0 {
		background: #161b22;
	}
	:global([data-theme='dark']) .level-1 {
		background: #0e4429;
	}
	:global([data-theme='dark']) .level-2 {
		background: #006d32;
	}
	:global([data-theme='dark']) .level-3 {
		background: #26a641;
	}
	:global([data-theme='dark']) .level-4 {
		background: #39d353;
	}

	.heatmap-legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.75rem;
		font-size: 0.75rem;
		color: var(--text-muted, #6c757d);
	}

	.legend-cells {
		display: flex;
		gap: 2px;
	}

	.legend-cell {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.legend-label {
		font-size: 0.7rem;
	}

	.tooltip {
		position: fixed;
		transform: translate(-50%, -100%);
		background: var(--bg-primary, white);
		border: 1px solid var(--border-color, #dee2e6);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		pointer-events: none;
		white-space: nowrap;
	}

	.tooltip-date {
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 0.25rem;
	}

	.tooltip-stats {
		font-size: 0.8rem;
		color: var(--text-secondary, #6c757d);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.stats-row {
			gap: 0.75rem;
		}

		.stat {
			font-size: 0.75rem;
		}

		.heatmap-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
