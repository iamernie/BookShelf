<script lang="ts">
	import { Star, BookOpen, CheckCircle, ChevronRight } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import type { SeriesCardData } from '$lib/server/services/seriesService';

	let {
		series,
		onclick
	}: {
		series: SeriesCardData;
		onclick: () => void;
	} = $props();

	// Determine which cover image to show
	const coverUrl = $derived(
		series.coverBook?.coverImageUrl || '/placeholder.png'
	);

	// Get genre to display (explicit or inferred)
	const displayGenre = $derived(
		series.genreName
			? { name: series.genreName, color: series.genreColor, icon: series.genreIcon, isInferred: false }
			: series.inferredGenre
				? { name: series.inferredGenre.name, color: series.inferredGenre.color, icon: series.inferredGenre.icon, isInferred: true }
				: null
	);
</script>

<button
	type="button"
	class="series-card"
	onclick={onclick}
>
	<div class="card-with-thumb">
		<!-- Cover Thumbnail -->
		<div class="card-thumb">
			<img
				src={coverUrl}
				alt={series.coverBook?.title || series.title}
				loading="lazy"
				onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/placeholder.png'; }}
			/>
		</div>

		<div class="card-content">
			<!-- Header: Title + Author -->
			<div class="card-header">
				<h3 class="card-title">{series.title}</h3>
				{#if series.primaryAuthor}
					<div class="card-author">
						<DynamicIcon icon="fas fa-user-edit" size={12} />
						{series.primaryAuthor.name}
					</div>
				{/if}
			</div>

			<!-- Progress Bar -->
			{#if series.bookCount > 0}
				<div class="card-progress">
					<div class="progress-bar">
						<div
							class="progress-fill"
							class:complete={series.completionPercentage === 100}
							style="width: {series.completionPercentage}%"
						></div>
					</div>
					<div class="progress-text">
						<span class="progress-count">
							{series.readBooks} / {series.bookCount} books
						</span>
						<span class="progress-percent">
							{series.completionPercentage}%
						</span>
					</div>
				</div>
			{:else}
				<div class="card-next info">
					<BookOpen class="w-3 h-3" />
					<span>No books in series yet</span>
				</div>
			{/if}

			<!-- Next Up -->
			{#if series.completionPercentage === 100}
				<div class="card-next complete">
					<CheckCircle class="w-3 h-3" />
					<strong>Complete!</strong>
				</div>
			{:else if series.nextBook}
				<div class="card-next">
					<span class="label">Next:</span>
					<span class="next-book">{series.nextBook.title}</span>
					<ChevronRight class="w-3 h-3" />
				</div>
			{:else if series.bookCount > 0 && series.readBooks < series.bookCount}
				<div class="card-next">
					<span class="label">Next:</span>
					<span>{series.bookCount - series.readBooks} books remaining</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Bottom Row: Rating | Genre | Status -->
	<div class="card-bottom">
		<div class="bottom-left">
			{#if series.averageRating && series.averageRating > 0}
				<span class="rating">
					<Star class="w-3 h-3" />
					{series.averageRating.toFixed(1)}
				</span>
			{/if}
		</div>

		<div class="bottom-meta">
			{#if displayGenre}
				<span
					class="genre-badge"
					style="background-color: {displayGenre.color || '#6c757d'};"
					title="{displayGenre.name}{displayGenre.isInferred ? ' (inferred)' : ''}"
				>
					{#if displayGenre.isInferred}
						<DynamicIcon icon="fas fa-magic" size={10} />
					{/if}
					{#if displayGenre.icon}
						<DynamicIcon icon={displayGenre.icon} size={10} />
					{/if}
					{displayGenre.name}
				</span>
			{/if}

			{#if series.statusName}
				<span
					class="status-badge"
					style="background-color: {series.statusColor || '#6c757d'};"
					title="Series Status: {series.statusName}"
				>
					{#if series.statusIcon}
						<DynamicIcon icon={series.statusIcon} size={10} />
					{/if}
					{series.statusName}
				</span>
			{/if}
		</div>
	</div>
</button>

<style>
	.series-card {
		background-color: var(--bg-secondary);
		border-radius: 0.75rem;
		border: 1px solid var(--border-color);
		padding: 0.75rem;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.series-card:hover {
		background-color: var(--bg-hover);
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.card-with-thumb {
		display: flex;
		gap: 0.75rem;
	}

	.card-thumb {
		width: 50px;
		height: 75px;
		flex-shrink: 0;
		border-radius: 0.375rem;
		overflow: hidden;
		background-color: var(--bg-tertiary);
	}

	.card-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.card-title {
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.3;
	}

	.card-author {
		font-size: 0.75rem;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 0.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Progress bar */
	.card-progress {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.progress-bar {
		height: 6px;
		background-color: var(--bg-tertiary);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--accent);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.progress-fill.complete {
		background-color: #10b981;
	}

	.progress-text {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.progress-count {
		font-weight: 500;
	}

	.progress-percent {
		font-weight: 600;
		color: var(--text-secondary);
	}

	/* Next up line */
	.card-next {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		overflow: hidden;
	}

	.card-next .label {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.card-next .next-book {
		color: var(--accent);
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-next.complete {
		color: #10b981;
	}

	.card-next.complete strong {
		font-weight: 600;
	}

	.card-next.info {
		color: var(--text-muted);
	}

	/* Bottom row */
	.card-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-color);
	}

	.bottom-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.rating {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #f59e0b;
	}

	.bottom-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.genre-badge,
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.5rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		color: white;
	}
</style>
