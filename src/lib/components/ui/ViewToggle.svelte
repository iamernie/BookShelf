<script lang="ts">
	import { Grid, List, Library } from 'lucide-svelte';
	import type { BrowseView } from '$lib/utils/browse';

	let {
		view,
		views,
		onchange
	}: {
		view: BrowseView;
		views: readonly BrowseView[];
		onchange: (view: BrowseView) => void;
	} = $props();

	const labels: Record<BrowseView, string> = { grid: 'Grid view', series: 'Series view', list: 'List view' };
	const icons = { grid: Grid, series: Library, list: List };
</script>

<div class="view-toggle" role="group" aria-label="View">
	{#each views as v (v)}
		{@const Icon = icons[v]}
		<button
			type="button"
			class="view-btn"
			class:active={view === v}
			aria-label={labels[v]}
			aria-pressed={view === v}
			title={labels[v]}
			onclick={() => onchange(v)}
		>
			<Icon class="w-4 h-4" />
		</button>
	{/each}
</div>

<style>
	.view-toggle {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		flex-shrink: 0;
		padding: 0.125rem;
		border-radius: 0.375rem;
		background-color: var(--bg-tertiary);
	}

	.view-btn {
		padding: 0.375rem;
		border-radius: 0.25rem;
		border: none;
		background-color: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: background-color 0.15s, color 0.15s;
	}

	.view-btn.active {
		background-color: var(--bg-secondary);
		color: var(--text-primary);
	}

	.view-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>
