<script lang="ts">
	import { ArrowUp, ArrowDown } from 'lucide-svelte';
	import type { ListColumn, SortOrder } from '$lib/utils/browse';

	let {
		gridClass,
		columns,
		sortField,
		sortOrder,
		onSort
	}: {
		/** The surface's .list-grid-* class, passed as a literal so it matches the rows exactly */
		gridClass: string;
		columns: readonly ListColumn[];
		sortField: string;
		sortOrder: SortOrder;
		onSort: (field: string) => void;
	} = $props();
</script>

<div class="list-header {gridClass}">
	{#each columns as column (column.key)}
		{#if column.sort}
			{@const active = sortField === column.sort}
			<button
				type="button"
				class="col sortable {column.hide ?? ''}"
				class:active
				onclick={() => onSort(column.sort!)}
			>
				<span>{column.label}</span>
				{#if active}
					{#if sortOrder === 'asc'}
						<ArrowUp class="sort-icon" aria-hidden="true" />
					{:else}
						<ArrowDown class="sort-icon" aria-hidden="true" />
					{/if}
					<span class="sr-only">, sorted {sortOrder === 'asc' ? 'ascending' : 'descending'}</span>
				{/if}
			</button>
		{:else}
			<div class="col {column.hide ?? ''}">{column.label}</div>
		{/if}
	{/each}
</div>

<style>
	.list-header {
		padding-block: 0.5rem;
		background-color: var(--bg-tertiary);
		border-bottom: 1px solid var(--border-color);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.col {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		text-transform: inherit;
		letter-spacing: inherit;
		text-align: left;
	}

	button.sortable {
		cursor: pointer;
		transition: color 0.15s;
	}

	button.sortable:hover {
		color: var(--text-primary);
	}

	button.sortable:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 0.125rem;
	}

	button.active {
		color: var(--accent);
	}

	.list-header :global(.sort-icon) {
		width: 0.75rem;
		height: 0.75rem;
		flex-shrink: 0;
	}
</style>
