<script lang="ts">
	import { BookOpen, Star, FileText } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import type { BookCardData } from '$lib/types';

	let {
		book,
		selected = false,
		selectable = false,
		showStatus = true,
		showTags = true,
		showAuthor = true,
		showSeries = true,
		onSelect,
		onClick
	}: {
		book: BookCardData;
		selected?: boolean;
		selectable?: boolean;
		showStatus?: boolean;
		showTags?: boolean;
		showAuthor?: boolean;
		showSeries?: boolean;
		onSelect?: (id: number) => void;
		onClick?: (book: BookCardData) => void;
	} = $props();

	function handleClick(e: MouseEvent) {
		// Don't trigger click if clicking checkbox
		if ((e.target as HTMLElement).closest('input[type=checkbox]')) {
			return;
		}
		onClick?.(book);
	}

	function handleCheckbox(e: Event) {
		e.stopPropagation();
		onSelect?.(book.id);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onClick?.(book);
		}
	}

	// Get first 3 tags for display in list view
	let displayTags = $derived((book.tags || []).slice(0, 3));
</script>

<button
	type="button"
	class="book-row"
	class:selected
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	<!-- Checkbox Column -->
	{#if selectable}
		<div class="col col-checkbox">
			<input
				type="checkbox"
				checked={selected}
				onchange={handleCheckbox}
				onclick={(e) => e.stopPropagation()}
				class="row-checkbox"
			/>
		</div>
	{/if}

	<!-- Cover + Title Column -->
	<div class="col col-title">
		<div class="cover-thumb">
			<img
				src={book.coverImageUrl || '/placeholder.png'}
				alt={book.title}
				loading="lazy"
				onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
			/>
			{#if book.ebookPath}
				<div class="ebook-indicator" title="Has ebook">
					<FileText class="w-2 h-2" />
				</div>
			{/if}
		</div>
		<div class="title-info">
			<h3 class="book-title">{book.title}</h3>
			{#if showAuthor && book.authorName}
				<span class="book-author">{book.authorName}</span>
			{/if}
		</div>
	</div>

	<!-- Series Column -->
	{#if showSeries}
		<div class="col col-series">
			{#if book.seriesName}
				<span class="series-name">{book.seriesName}</span>
				{#if book.bookNum}
					<span class="book-num">#{book.bookNum}</span>
				{/if}
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>
	{/if}

	<!-- Status Column -->
	{#if showStatus}
		<div class="col col-status">
			{#if book.status}
				<div
					class="status-badge"
					style="background-color: {book.status.color || '#6c757d'}"
				>
					{#if book.status.icon}
						<DynamicIcon icon={book.status.icon} size={11} />
					{/if}
					<span>{book.status.name}</span>
				</div>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>
	{/if}

	<!-- Format Column -->
	<div class="col col-format">
		{#if book.format}
			<span class="format-badge">{book.format.name}</span>
		{:else}
			<span class="empty-cell">—</span>
		{/if}
	</div>

	<!-- Rating Column -->
	<div class="col col-rating">
		{#if book.rating}
			<div class="rating-display">
				<Star class="w-3.5 h-3.5 star-icon" />
				<span>{book.rating.toFixed(1)}</span>
			</div>
		{:else}
			<span class="empty-cell">—</span>
		{/if}
	</div>

	<!-- Genre Column -->
	<div class="col col-genre">
		{#if book.genre}
			<span class="genre-text">{book.genre.name}</span>
		{:else}
			<span class="empty-cell">—</span>
		{/if}
	</div>

	<!-- Tags Column -->
	{#if showTags}
		<div class="col col-tags">
			{#if displayTags.length > 0}
				<div class="tags-container">
					{#each displayTags as tag}
						<a
							href="/books?tag={tag.id}"
							class="tag-badge hover:brightness-110 transition-all"
							style="background-color: {tag.color || '#6c757d'}20; border-color: {tag.color || '#6c757d'}40; color: {tag.color || '#6c757d'}"
							title={tag.name}
							onclick={(e) => e.stopPropagation()}
						>
							{tag.name}
						</a>
					{/each}
					{#if (book.tags?.length || 0) > 3}
						<span class="tag-more">+{(book.tags?.length || 0) - 3}</span>
					{/if}
				</div>
			{:else}
				<span class="empty-cell">—</span>
			{/if}
		</div>
	{/if}
</button>

<style>
	.book-row {
		display: grid;
		grid-template-columns:
			minmax(200px, 2fr)  /* Title */
			minmax(100px, 1fr)  /* Series */
			90px               /* Status */
			80px               /* Format */
			60px               /* Rating */
			80px               /* Genre */
			minmax(100px, 1fr); /* Tags */
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 1rem;
		text-align: left;
		background-color: transparent;
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	/* Adjust grid for checkbox */
	.book-row:has(.col-checkbox) {
		grid-template-columns:
			28px               /* Checkbox */
			minmax(180px, 2fr) /* Title */
			minmax(100px, 1fr) /* Series */
			90px               /* Status */
			80px               /* Format */
			60px               /* Rating */
			80px               /* Genre */
			minmax(100px, 1fr); /* Tags */
	}

	.book-row:hover {
		background-color: var(--bg-hover);
	}

	.book-row.selected {
		background-color: var(--accent-muted, rgba(59, 130, 246, 0.1));
	}

	.col {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.col-checkbox {
		justify-content: center;
	}

	.row-checkbox {
		width: 1rem;
		height: 1rem;
		border-radius: 0.25rem;
		accent-color: var(--accent);
		cursor: pointer;
	}

	/* Title Column */
	.col-title {
		gap: 0.625rem;
	}

	.cover-thumb {
		position: relative;
		width: 2rem;
		height: 2.75rem;
		border-radius: 0.25rem;
		overflow: hidden;
		flex-shrink: 0;
		background-color: var(--bg-tertiary);
	}

	.cover-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.ebook-indicator {
		position: absolute;
		bottom: 1px;
		left: 1px;
		padding: 2px;
		border-radius: 50%;
		background-color: var(--accent);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.title-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 0.125rem;
	}

	.book-title {
		font-weight: 500;
		font-size: 0.875rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0;
		line-height: 1.25;
	}

	.book-author {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Series Column */
	.col-series {
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
	}

	.series-name {
		font-size: 0.8rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.book-num {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--accent);
	}

	/* Status Column */
	.col-status {
		justify-content: flex-start;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.1875rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: white;
		white-space: nowrap;
	}

	/* Format Column */
	.col-format {
		justify-content: flex-start;
	}

	.format-badge {
		display: inline-block;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-secondary);
		background-color: var(--bg-tertiary);
		white-space: nowrap;
	}

	/* Rating Column */
	.col-rating {
		justify-content: flex-start;
	}

	.rating-display {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.star-icon {
		color: #f59e0b;
		fill: #f59e0b;
	}

	/* Genre Column */
	.col-genre {
		justify-content: flex-start;
	}

	.genre-text {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Tags Column */
	.col-tags {
		justify-content: flex-start;
	}

	.tags-container {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: nowrap;
		overflow: hidden;
	}

	.tag-badge {
		display: inline-block;
		padding: 0.0625rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 500;
		white-space: nowrap;
		border: 1px solid;
	}

	.tag-more {
		font-size: 0.65rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.empty-cell {
		color: var(--text-muted);
		opacity: 0.5;
		font-size: 0.8rem;
	}

	/* Responsive: Hide less important columns on smaller screens */
	@media (max-width: 1200px) {
		.book-row {
			grid-template-columns:
				minmax(200px, 2fr)
				minmax(100px, 1fr)
				90px
				80px
				60px
				80px;
		}

		.book-row:has(.col-checkbox) {
			grid-template-columns:
				28px
				minmax(180px, 2fr)
				minmax(100px, 1fr)
				90px
				80px
				60px
				80px;
		}

		.col-tags {
			display: none;
		}
	}

	@media (max-width: 900px) {
		.book-row {
			grid-template-columns:
				minmax(180px, 2fr)
				minmax(80px, 1fr)
				85px
				60px;
		}

		.book-row:has(.col-checkbox) {
			grid-template-columns:
				28px
				minmax(160px, 2fr)
				minmax(80px, 1fr)
				85px
				60px;
		}

		.col-format,
		.col-genre {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.book-row {
			grid-template-columns:
				minmax(150px, 1fr)
				80px;
		}

		.book-row:has(.col-checkbox) {
			grid-template-columns:
				28px
				minmax(130px, 1fr)
				80px;
		}

		.col-series,
		.col-rating {
			display: none;
		}

		.cover-thumb {
			width: 1.75rem;
			height: 2.5rem;
		}
	}
</style>
