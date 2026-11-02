<script lang="ts">
	import { Star } from 'lucide-svelte';
	import type { AuthorWithStats } from '$lib/server/services/authorService';

	let { author }: { author: AuthorWithStats } = $props();

	// Author photo, else a cover from their books (as AuthorCard)
	const imageUrl = $derived(author.photoUrl || author.coverBook?.coverUrl || '/placeholder.png');
	const displayTags = $derived((author.tags || []).slice(0, 3));
	const extraTags = $derived(Math.max(0, (author.tags?.length || 0) - 3));
</script>

<li>
	<a href="/authors/{author.id}" class="entity-row list-grid-authors">
		<div class="cell-title">
			<div class="thumb">
				<img
					src={imageUrl}
					alt=""
					loading="lazy"
					onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/placeholder.png'; }}
				/>
			</div>
			<div class="title-text">
				<span class="row-title">{author.name}</span>
			</div>
		</div>

		<div class="cell">
			<span class="count">{author.bookCount}</span>
		</div>

		<div class="cell hide-640">
			{#if author.readCount > 0}
				<span class="count">{author.completionPercentage}%</span>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>

		<div class="cell hide-640">
			{#if author.averageRating}
				<Star class="w-3.5 h-3.5 star-icon" />
				<span>{author.averageRating.toFixed(1)}</span>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>

		<div class="cell hide-900">
			{#if author.inferredGenre}
				<span class="truncate-text">{author.inferredGenre.name}</span>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>

		<div class="cell hide-1200">
			{#if displayTags.length > 0}
				<div class="tags">
					{#each displayTags as tag (tag.id)}
						<span
							class="tag-badge"
							style="background-color: {tag.color || '#6c757d'}20; border-color: {tag.color || '#6c757d'}40; color: {tag.color || '#6c757d'}"
						>{tag.name}</span>
					{/each}
					{#if extraTags > 0}
						<span class="tag-more">+{extraTags}</span>
					{/if}
				</div>
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




	.cell :global(.star-icon) {
		flex-shrink: 0;
		color: #f59e0b;
		fill: #f59e0b;
	}


	.tags {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		overflow: hidden;
	}

	.tag-badge {
		display: inline-block;
		flex-shrink: 0;
		padding: 0.0625rem 0.375rem;
		border-radius: 0.25rem;
		border: 1px solid;
		font-size: 0.65rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.tag-more {
		flex-shrink: 0;
		font-size: 0.65rem;
		color: var(--text-muted);
	}

	.empty-cell {
		color: var(--text-muted);
		opacity: 0.5;
	}
</style>
