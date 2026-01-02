<script lang="ts">
	/**
	 * LucideIcon - Renders a Lucide icon from a name string
	 *
	 * Usage:
	 *   <LucideIcon name="book" />
	 *   <LucideIcon name="target" size={20} />
	 */
	import * as icons from 'lucide-svelte';

	let {
		name,
		size = 16,
		color,
		class: className = ''
	}: {
		name: string | null | undefined;
		size?: number;
		color?: string;
		class?: string;
	} = $props();

	// Convert kebab-case to PascalCase
	function toPascalCase(str: string): string {
		return str
			.split('-')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join('');
	}

	// Get the icon component dynamically
	const IconComponent = $derived(() => {
		if (!name) return icons.BookOpen;
		const pascalName = toPascalCase(name);
		const iconMap = icons as unknown as Record<string, typeof icons.BookOpen>;
		return iconMap[pascalName] || icons.BookOpen;
	});
</script>

<svelte:component
	this={IconComponent()}
	class={className}
	style="width: {size}px; height: {size}px;{color ? ` color: ${color};` : ''}"
/>
