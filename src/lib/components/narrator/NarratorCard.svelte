<script lang="ts">
	import { Mic, Headphones, Star } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';

	interface TagInfo {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	}

	interface NarratorWithStats {
		id: number;
		name: string;
		photoUrl?: string | null;
		audiobookCount: number;
		bookCount: number;
		avgRating: number | null;
		coverBook?: { id: number; title: string; coverImageUrl: string | null } | null;
		tags?: TagInfo[];
	}

	let {
		narrator,
		onclick
	}: {
		narrator: NarratorWithStats;
		onclick: () => void;
	} = $props();

	// Get up to 3 tags to display
	let displayTags = $derived((narrator.tags || []).slice(0, 3));

	// Format rating for display
	let displayRating = $derived(
		narrator.avgRating ? narrator.avgRating.toFixed(1) : null
	);

	// Get image to display - prioritize narrator photo, then cover book, then placeholder
	let displayImage = $derived(narrator.photoUrl || narrator.coverBook?.coverImageUrl || '/placeholder.png');

	// Track if image failed to load
	let imageError = $state(false);

	function handleImageError() {
		imageError = true;
	}

	// Check if we have a valid image to display (and it hasn't errored)
	let hasValidImage = $derived(
		!imageError && (narrator.photoUrl || narrator.coverBook?.coverImageUrl)
	);

	// Total count of audiobooks/books
	let totalCount = $derived(narrator.audiobookCount + narrator.bookCount);
</script>

<button
	type="button"
	class="narrator-card"
	onclick={onclick}
>
	<div class="card-content">
		<!-- Narrator photo or cover book -->
		<div class="narrator-image-container">
			{#if hasValidImage}
				<img
					src={displayImage}
					alt={narrator.coverBook?.title || narrator.name}
					class="cover-image"
					onerror={handleImageError}
				/>
			{:else}
				<div class="cover-placeholder">
					<Mic class="w-8 h-8" />
				</div>
			{/if}
		</div>

		<div class="narrator-info">
			<h3 class="narrator-name">{narrator.name}</h3>

			<!-- Stats row -->
			<div class="stats-row">
				<span class="stat" title="Total audiobooks">
					<Headphones class="w-3.5 h-3.5" />
					{totalCount}
				</span>

				{#if displayRating}
					<span class="stat" title="Average rating">
						<Star class="w-3.5 h-3.5" />
						{displayRating}
					</span>
				{/if}
			</div>

			<!-- Tags -->
			{#if displayTags.length > 0}
				<div class="tags-row">
					{#each displayTags as tag (tag.id)}
						<span class="narrator-tag" style="--tag-color: {tag.color || '#6c757d'}">
							{#if tag.icon}
								<DynamicIcon icon={tag.icon} size={10} />
							{:else}
								<span class="tag-dot" style="background-color: {tag.color || '#6c757d'}"></span>
							{/if}
							{tag.name}
						</span>
					{/each}
					{#if (narrator.tags?.length || 0) > 3}
						<span class="more-tags">+{(narrator.tags?.length || 0) - 3}</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</button>

<style>
	.narrator-card {
		background-color: var(--bg-secondary);
		border-radius: 0.75rem;
		border: 1px solid var(--border-color);
		padding: 1rem;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: all 0.2s ease;
	}

	.narrator-card:hover {
		background-color: var(--bg-hover);
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.card-content {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.narrator-image-container {
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

	.cover-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--bg-tertiary);
		border-radius: 0.375rem;
		color: var(--text-muted);
	}

	.narrator-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.narrator-name {
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.95rem;
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

	.narrator-tag {
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
