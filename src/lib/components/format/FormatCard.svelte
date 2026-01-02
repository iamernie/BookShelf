<script lang="ts">
	import { BookOpen } from 'lucide-svelte';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';

	let {
		format,
		onclick
	}: {
		format: {
			id: number;
			name: string;
			icon?: string | null;
			color?: string | null;
			bookCount: number;
		};
		onclick: () => void;
	} = $props();

	const iconName = $derived(format.icon || 'book');
	const iconColor = $derived(format.color || '#6c757d');
</script>

<button
	type="button"
	class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
	onclick={onclick}
>
	<div class="flex items-center gap-4">
		<div
			class="w-12 h-12 rounded-lg flex items-center justify-center"
			style="background-color: {iconColor}20;"
		>
			<LucideIcon name={iconName} size={24} color={iconColor} />
		</div>

		<div class="flex-1 min-w-0">
			<h3 class="font-medium text-gray-900 truncate">{format.name}</h3>
			<p class="text-sm text-gray-500 flex items-center gap-1 mt-1">
				<BookOpen class="w-4 h-4" />
				{format.bookCount} {format.bookCount === 1 ? 'book' : 'books'}
			</p>
		</div>
	</div>
</button>
