<script lang="ts">
	import { sortOptions, type BrowseSurface, type SortOrder } from '$lib/utils/browse';

	let {
		surface,
		sort,
		order,
		label,
		onchange
	}: {
		surface: BrowseSurface;
		sort: string;
		order: SortOrder;
		/** Accessible name, e.g. "Sort series by" */
		label: string;
		onchange: (sort: string, order: SortOrder) => void;
	} = $props();

	// Includes the active combination even when only a header click can produce it
	let options = $derived(sortOptions(surface, sort, order));
</script>

<select
	class="select py-1.5 text-sm flex-shrink-0"
	style="width: auto;"
	aria-label={label}
	value={`${sort}-${order}`}
	onchange={(e) => {
		const value = e.currentTarget.value;
		const i = value.lastIndexOf('-');
		onchange(value.slice(0, i), value.slice(i + 1) as SortOrder);
	}}
>
	{#each options as option (option.value)}
		<option value={option.value}>{option.label}</option>
	{/each}
</select>
