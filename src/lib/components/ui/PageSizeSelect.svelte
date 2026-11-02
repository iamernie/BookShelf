<script lang="ts">
	import { BROWSE_SURFACES, type BrowseSurface } from '$lib/utils/browse';

	let {
		surface,
		limit,
		onchange
	}: {
		surface: BrowseSurface;
		limit: number;
		onchange: (limit: number) => void;
	} = $props();
</script>

<select
	class="select py-1.5 text-sm flex-shrink-0"
	style="width: auto;"
	aria-label="Items per page"
	title="Items per page"
	value={limit}
	onchange={(e) => onchange(Number(e.currentTarget.value))}
>
	{#each BROWSE_SURFACES[surface].limits as size (size)}
		<option value={size}>{size}</option>
	{/each}
</select>
