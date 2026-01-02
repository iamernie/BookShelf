<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Size variant: 'compact' shows more smaller cards, 'normal' is default, 'large' for fewer bigger cards */
		size?: 'compact' | 'normal' | 'large';
		/** Gap between items */
		gap?: 'sm' | 'md' | 'lg';
		/** Additional CSS classes */
		class?: string;
		/** Slot content */
		children: Snippet;
	}

	let {
		size = 'normal',
		gap = 'sm',
		class: className = '',
		children
	}: Props = $props();

	// Grid column configurations based on size
	const gridCols = {
		compact: 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12',
		normal: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10',
		large: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
	};

	const gapClasses = {
		sm: 'gap-2',
		md: 'gap-3',
		lg: 'gap-4'
	};
</script>

<div class="grid {gridCols[size]} {gapClasses[gap]} {className}">
	{@render children()}
</div>
