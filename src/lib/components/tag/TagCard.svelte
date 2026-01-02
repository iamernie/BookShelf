<script lang="ts">
	import { BookOpen, Library, Lock } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';

	let {
		tag,
		onclick
	}: {
		tag: {
			id: number;
			name: string;
			color: string | null;
			icon: string | null;
			isSystem: boolean | null;
			bookCount: number;
			seriesCount: number;
		};
		onclick: () => void;
	} = $props();

	// Map simple icon names to Font Awesome classes
	function getIconClass(icon: string | null): string {
		if (!icon) return 'fas fa-tag';
		// If already a FA class, use it directly
		if (icon.startsWith('fas ') || icon.startsWith('far ') || icon.startsWith('fab ')) {
			return icon;
		}
		// Map simple names to FA classes
		const iconMap: Record<string, string> = {
			heart: 'fas fa-heart',
			star: 'fas fa-star',
			tag: 'fas fa-tag',
			bookmark: 'fas fa-bookmark',
			book: 'fas fa-book',
			gift: 'fas fa-gift',
			fire: 'fas fa-fire',
			trophy: 'fas fa-trophy',
			crown: 'fas fa-crown',
			flag: 'fas fa-flag'
		};
		return iconMap[icon] || 'fas fa-tag';
	}
</script>

<button
	type="button"
	class="tag-card"
	onclick={onclick}
>
	<div class="flex items-center gap-4">
		<div
			class="tag-icon-wrapper"
			style="background-color: {tag.color || '#6c757d'}20"
		>
			<span style="color: {tag.color || '#6c757d'}">
				<DynamicIcon icon={getIconClass(tag.icon)} size={24} />
			</span>
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2">
				<h3 class="tag-name">{tag.name}</h3>
				{#if tag.isSystem}
					<Lock class="w-3.5 h-3.5" style="color: var(--text-muted);" aria-label="System tag" />
				{/if}
			</div>
			<div class="tag-counts">
				<span class="flex items-center gap-1">
					<BookOpen class="w-4 h-4" />
					{tag.bookCount} {tag.bookCount === 1 ? 'book' : 'books'}
				</span>
				{#if tag.seriesCount > 0}
					<span class="flex items-center gap-1">
						<Library class="w-4 h-4" />
						{tag.seriesCount} {tag.seriesCount === 1 ? 'series' : 'series'}
					</span>
				{/if}
			</div>
		</div>

		<div
			class="tag-indicator"
			style="background-color: {tag.color || '#6c757d'}"
			title={tag.color}
		></div>
	</div>
</button>

<style>
	.tag-card {
		background-color: var(--bg-secondary);
		border-radius: 0.75rem;
		border: 1px solid var(--border-color);
		padding: 1rem;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: all 0.2s ease;
	}

	.tag-card:hover {
		background-color: var(--bg-hover);
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.tag-icon-wrapper {
		width: 3rem;
		height: 3rem;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tag-name {
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag-counts {
		font-size: 0.875rem;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}

	.tag-indicator {
		width: 1rem;
		height: 1rem;
		border-radius: 9999px;
		border: 2px solid var(--bg-primary);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
</style>
