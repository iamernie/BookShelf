<script lang="ts">
	import { User, BookOpen, Star, TrendingUp } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';

	interface TagInfo {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	}

	interface AuthorWithStats {
		id: number;
		name: string;
		photoUrl: string | null;
		bookCount: number;
		readCount?: number;
		averageRating?: number | null;
		completionPercentage?: number;
		inferredGenre?: { id: number; name: string; color: string | null } | null;
		coverBook?: { id: number; title: string; coverUrl: string | null } | null;
		tags?: TagInfo[];
	}

	let {
		author,
		onclick
	}: {
		author: AuthorWithStats;
		onclick: () => void;
	} = $props();

	// Get up to 3 tags to display
	let displayTags = $derived((author.tags || []).slice(0, 3));

	// Format rating for display
	let displayRating = $derived(
		author.averageRating ? author.averageRating.toFixed(1) : null
	);

	// Get completion percentage
	let completionPct = $derived(author.completionPercentage || 0);

	// Get image to display - prioritize author photo, then cover book, then placeholder
	let displayImage = $derived(author.photoUrl || author.coverBook?.coverUrl || '/placeholder.png');

	// Track if image failed to load
	let imageError = $state(false);

	function handleImageError() {
		imageError = true;
	}

	// Check if we have a valid image to display (and it hasn't errored)
	let hasValidImage = $derived(
		!imageError && (author.photoUrl || author.coverBook?.coverUrl)
	);
</script>

<button
	type="button"
	class="author-card"
	onclick={onclick}
>
	<div class="card-content">
		<!-- Author photo or cover book -->
		<div class="author-image-container">
			{#if hasValidImage}
				<img
					src={displayImage}
					alt={author.coverBook?.title || author.name}
					class="cover-image"
					onerror={handleImageError}
				/>
			{:else}
				<img
					src="/placeholder.png"
					alt={author.name}
					class="cover-image placeholder"
				/>
			{/if}
		</div>

		<div class="author-info">
			<h3 class="author-name">{author.name}</h3>

			<!-- Genre badge if available -->
			{#if author.inferredGenre}
				<span
					class="genre-badge"
					style={author.inferredGenre.color ? `background-color: ${author.inferredGenre.color}20; color: ${author.inferredGenre.color}` : ''}
				>
					{author.inferredGenre.name}
				</span>
			{/if}

			<!-- Stats row -->
			<div class="stats-row">
				<span class="stat" title="Total books">
					<BookOpen class="w-3.5 h-3.5" />
					{author.bookCount}
				</span>

				{#if displayRating}
					<span class="stat" title="Average rating">
						<Star class="w-3.5 h-3.5" />
						{displayRating}
					</span>
				{/if}

				{#if author.readCount !== undefined && author.readCount > 0}
					<span class="stat" title="Read progress">
						<TrendingUp class="w-3.5 h-3.5" />
						{completionPct}%
					</span>
				{/if}
			</div>

			<!-- Tags -->
			{#if displayTags.length > 0}
				<div class="tags-row">
					{#each displayTags as tag (tag.id)}
						<span class="author-tag" style="--tag-color: {tag.color || '#6c757d'}">
							{#if tag.icon}
								<DynamicIcon icon={tag.icon} size={10} />
							{:else}
								<span class="tag-dot" style="background-color: {tag.color || '#6c757d'}"></span>
							{/if}
							{tag.name}
						</span>
					{/each}
					{#if (author.tags?.length || 0) > 3}
						<span class="more-tags">+{(author.tags?.length || 0) - 3}</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</button>

<style>
	.author-card {
		background-color: var(--bg-secondary);
		border-radius: 0.75rem;
		border: 1px solid var(--border-color);
		padding: 1rem;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: all 0.2s ease;
	}

	.author-card:hover {
		background-color: var(--bg-hover);
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.card-content {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.author-image-container {
		flex-shrink: 0;
		width: 4rem;
		height: 5rem;
	}

	.cover-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 0.375rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.cover-image.placeholder {
		opacity: 0.6;
	}

	.author-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.author-name {
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.95rem;
	}

	.genre-badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 500;
		background-color: var(--bg-tertiary);
		color: var(--text-muted);
		width: fit-content;
	}

	.stats-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.tags-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}

	.author-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 500;
		color: var(--tag-color);
		background-color: color-mix(in srgb, var(--tag-color) 15%, transparent);
	}

	.tag-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.more-tags {
		font-size: 0.6rem;
		color: var(--text-muted);
		padding: 0.125rem 0.25rem;
	}
</style>
