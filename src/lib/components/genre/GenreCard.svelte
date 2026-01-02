<script lang="ts">
	import { Folder, BookOpen, Star } from 'lucide-svelte';

	let {
		genre,
		onclick
	}: {
		genre: {
			id: number;
			name: string;
			description: string | null;
			color: string | null;
			icon: string | null;
			bookCount: number;
			avgRating: number | null;
		};
		onclick: () => void;
	} = $props();
</script>

<button
	type="button"
	class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
	onclick={onclick}
>
	<div class="flex items-center gap-4">
		<div
			class="w-12 h-12 rounded-lg flex items-center justify-center"
			style="background-color: {genre.color || '#6c757d'}20"
		>
			<Folder class="w-6 h-6" style="color: {genre.color || '#6c757d'}" />
		</div>

		<div class="flex-1 min-w-0">
			<h3 class="font-medium text-gray-900 truncate">{genre.name}</h3>
			<div class="text-sm text-gray-500 flex items-center gap-3 mt-1">
				<span class="flex items-center gap-1">
					<BookOpen class="w-4 h-4" />
					{genre.bookCount} {genre.bookCount === 1 ? 'book' : 'books'}
				</span>
				{#if genre.avgRating}
					<span class="flex items-center gap-1">
						<Star class="w-4 h-4 fill-yellow-400 text-yellow-400" />
						{genre.avgRating}
					</span>
				{/if}
			</div>
		</div>

		{#if genre.color}
			<div
				class="w-4 h-4 rounded-full border-2 border-white shadow-sm"
				style="background-color: {genre.color}"
			></div>
		{/if}
	</div>
</button>
