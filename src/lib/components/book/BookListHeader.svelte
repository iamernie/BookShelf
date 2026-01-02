<script lang="ts">
	import { ArrowUp, ArrowDown } from 'lucide-svelte';

	type SortField = 'title' | 'series' | 'status' | 'format' | 'rating' | 'genre' | 'createdAt' | 'completedDate';

	let {
		selectable = false,
		showSeries = true,
		showStatus = true,
		showTags = true,
		allSelected = false,
		sortField = null,
		sortOrder = 'asc',
		onSelectAll,
		onSort
	}: {
		selectable?: boolean;
		showSeries?: boolean;
		showStatus?: boolean;
		showTags?: boolean;
		allSelected?: boolean;
		sortField?: SortField | null;
		sortOrder?: 'asc' | 'desc';
		onSelectAll?: () => void;
		onSort?: (field: SortField) => void;
	} = $props();

	function handleSort(field: SortField) {
		onSort?.(field);
	}

	// Check if sorting is enabled
	let sortable = $derived(!!onSort);
</script>

<div class="list-header" class:with-checkbox={selectable}>
	{#if selectable}
		<div class="col col-checkbox">
			<input
				type="checkbox"
				checked={allSelected}
				onchange={onSelectAll}
				class="header-checkbox"
				title="Select all"
			/>
		</div>
	{/if}

	<button
		type="button"
		class="col col-title"
		class:sortable
		class:active={sortField === 'title'}
		onclick={() => handleSort('title')}
		disabled={!sortable}
	>
		<span>Title</span>
		{#if sortField === 'title'}
			{#if sortOrder === 'asc'}
				<ArrowUp class="sort-icon" />
			{:else}
				<ArrowDown class="sort-icon" />
			{/if}
		{/if}
	</button>

	{#if showSeries}
		<button
			type="button"
			class="col col-series"
			class:sortable
			class:active={sortField === 'series'}
			onclick={() => handleSort('series')}
			disabled={!sortable}
		>
			<span>Series</span>
			{#if sortField === 'series'}
				{#if sortOrder === 'asc'}
					<ArrowUp class="sort-icon" />
				{:else}
					<ArrowDown class="sort-icon" />
				{/if}
			{/if}
		</button>
	{/if}

	{#if showStatus}
		<button
			type="button"
			class="col col-status"
			class:sortable
			class:active={sortField === 'status'}
			onclick={() => handleSort('status')}
			disabled={!sortable}
		>
			<span>Status</span>
			{#if sortField === 'status'}
				{#if sortOrder === 'asc'}
					<ArrowUp class="sort-icon" />
				{:else}
					<ArrowDown class="sort-icon" />
				{/if}
			{/if}
		</button>
	{/if}

	<button
		type="button"
		class="col col-format"
		class:sortable
		class:active={sortField === 'format'}
		onclick={() => handleSort('format')}
		disabled={!sortable}
	>
		<span>Format</span>
		{#if sortField === 'format'}
			{#if sortOrder === 'asc'}
				<ArrowUp class="sort-icon" />
			{:else}
				<ArrowDown class="sort-icon" />
			{/if}
		{/if}
	</button>

	<button
		type="button"
		class="col col-rating"
		class:sortable
		class:active={sortField === 'rating'}
		onclick={() => handleSort('rating')}
		disabled={!sortable}
	>
		<span>Rating</span>
		{#if sortField === 'rating'}
			{#if sortOrder === 'asc'}
				<ArrowUp class="sort-icon" />
			{:else}
				<ArrowDown class="sort-icon" />
			{/if}
		{/if}
	</button>

	<button
		type="button"
		class="col col-genre"
		class:sortable
		class:active={sortField === 'genre'}
		onclick={() => handleSort('genre')}
		disabled={!sortable}
	>
		<span>Genre</span>
		{#if sortField === 'genre'}
			{#if sortOrder === 'asc'}
				<ArrowUp class="sort-icon" />
			{:else}
				<ArrowDown class="sort-icon" />
			{/if}
		{/if}
	</button>

	{#if showTags}
		<div class="col col-tags">Tags</div>
	{/if}
</div>

<style>
	.list-header {
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
		padding: 0.5rem 1rem;
		background-color: var(--bg-tertiary);
		border-bottom: 1px solid var(--border-color);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.list-header.with-checkbox {
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

	.col {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		text-transform: inherit;
		letter-spacing: inherit;
	}

	button.col {
		cursor: default;
	}

	button.col.sortable {
		cursor: pointer;
		transition: color 0.15s;
	}

	button.col.sortable:hover {
		color: var(--text-primary);
	}

	button.col.active {
		color: var(--accent);
	}

	.sort-icon {
		width: 0.75rem;
		height: 0.75rem;
		flex-shrink: 0;
	}

	.col-checkbox {
		justify-content: center;
	}

	.header-checkbox {
		width: 0.875rem;
		height: 0.875rem;
		border-radius: 0.25rem;
		accent-color: var(--accent);
		cursor: pointer;
	}

	/* Responsive: Hide columns to match BookRow */
	@media (max-width: 1200px) {
		.list-header {
			grid-template-columns:
				minmax(200px, 2fr)
				minmax(100px, 1fr)
				90px
				80px
				60px
				80px;
		}

		.list-header.with-checkbox {
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
		.list-header {
			grid-template-columns:
				minmax(180px, 2fr)
				minmax(80px, 1fr)
				85px
				60px;
		}

		.list-header.with-checkbox {
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
		.list-header {
			grid-template-columns:
				minmax(150px, 1fr)
				80px;
		}

		.list-header.with-checkbox {
			grid-template-columns:
				28px
				minmax(130px, 1fr)
				80px;
		}

		.col-series,
		.col-rating {
			display: none;
		}
	}
</style>
