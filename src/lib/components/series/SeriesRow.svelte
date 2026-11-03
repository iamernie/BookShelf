<script lang="ts">
	import { Star } from 'lucide-svelte';
	import type { SeriesCardData } from '$lib/server/services/seriesService';

	let { series }: { series: SeriesCardData } = $props();

	const coverUrl = $derived(series.coverBook?.coverImageUrl || '/placeholder.png');

	// Explicit genre, else the most common genre of its books (as SeriesCard)
	const genre = $derived(
		series.genreName
			? { name: series.genreName, inferred: false }
			: series.inferredGenre
				? { name: series.inferredGenre.name, inferred: true }
				: null
	);

	// Whole-series total from Audible when known (as SeriesCard); the % uses the larger of total and owned
	const hasTotal = $derived(series.numBooks != null && series.numBooks > 0);
	const totalBooks = $derived(hasTotal ? series.numBooks! : series.bookCount);
	const percent = $derived(
		hasTotal
			? Math.min(100, Math.max(0, Math.round((series.readBooks / Math.max(series.numBooks!, series.bookCount)) * 100)))
			: series.completionPercentage
	);

	const complete = $derived(series.bookCount > 0 && series.completionPercentage === 100);
</script>

<li>
	<a href="/series/{series.id}" class="entity-row list-grid-series">
		<div class="cell-title">
			<div class="thumb">
				<img
					src={coverUrl}
					alt=""
					loading="lazy"
					onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/placeholder.png'; }}
				/>
			</div>
			<div class="title-text">
				<span class="row-title">{series.title}</span>
				{#if series.primaryAuthor}
					<span class="row-sub">{series.primaryAuthor.name}</span>
				{/if}
			</div>
		</div>

		<div class="cell">
			<span class="count">{series.readBooks} / {totalBooks}</span>
			{#if series.bookCount > 0}
				<span class="muted">{percent}%</span>
			{/if}
		</div>

		<div class="cell hide-640">
			{#if complete}
				<span class="complete">Complete</span>
			{:else if series.nextBook}
				{#if series.nextBook.bookNum != null}
					<span class="num">#{series.nextBook.bookNum}</span>
				{/if}
				<span class="truncate-text">{series.nextBook.title}</span>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>

		<div class="cell hide-900">
			{#if series.averageRating}
				<Star class="w-3.5 h-3.5 star-icon" />
				<span>{series.averageRating.toFixed(1)}</span>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>

		<div class="cell hide-900">
			{#if genre}
				<span class="truncate-text" class:inferred={genre.inferred} title={genre.inferred ? `${genre.name} (from its books)` : genre.name}>{genre.name}</span>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>

		<div class="cell hide-1200">
			{#if series.statusName}
				<span class="status-badge" style="background-color: {series.statusColor || '#6c757d'}">{series.statusName}</span>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>
	</a>
</li>

<style>
	.entity-row {
		padding-block: 0.625rem;
		color: inherit;
		text-decoration: none;
		transition: background-color 0.15s;
	}

	.entity-row:hover {
		background-color: var(--bg-hover);
	}

	.entity-row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.cell-title {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
	}

	.thumb {
		width: 2rem;
		height: 2.75rem;
		border-radius: 0.25rem;
		overflow: hidden;
		flex-shrink: 0;
		background-color: var(--bg-tertiary);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.title-text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.row-title,
	.row-sub,
	.truncate-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.row-title {
		font-weight: 500;
		font-size: 0.875rem;
		color: var(--text-primary);
		line-height: 1.25;
	}

	.row-sub {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.cell {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.count {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.num {
		flex-shrink: 0;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--accent);
	}

	.complete {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--accent);
	}

	.inferred {
		font-style: italic;
		color: var(--text-muted);
	}

	.cell :global(.star-icon) {
		flex-shrink: 0;
		color: #f59e0b;
		fill: #f59e0b;
	}

	.status-badge {
		display: inline-block;
		max-width: 100%;
		padding: 0.1875rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: white;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty-cell {
		color: var(--text-muted);
		opacity: 0.5;
	}
</style>
