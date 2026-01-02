<script lang="ts">
	import { Sparkles, ArrowRight } from 'lucide-svelte';
	import BookCard from '$lib/components/book/BookCard.svelte';
	import type { SmartCollectionData } from '$lib/server/services/dashboardService';

	interface Props {
		data: SmartCollectionData;
	}

	let { data }: Props = $props();
</script>

<section class="mb-8">
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2">
			<Sparkles class="w-5 h-5" style="color: var(--accent);" />
			<h2 class="text-xl font-semibold" style="color: var(--text-primary);">
				{data.shelfName || 'Smart Collection'}
			</h2>
		</div>

		{#if data.shelfId}
			<a
				href="/shelves/{data.shelfId}"
				class="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
				style="color: var(--accent);"
			>
				View All
				<ArrowRight class="w-4 h-4" />
			</a>
		{/if}
	</div>

	{#if data.books.length > 0}
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
			{#each data.books as book (book.id)}
				<BookCard {book} />
			{/each}
		</div>
	{:else}
		<div
			class="flex flex-col items-center justify-center py-12 rounded-lg border"
			style="background-color: var(--bg-secondary); border-color: var(--border-color);"
		>
			<Sparkles class="w-12 h-12 mb-3" style="color: var(--text-muted);" />
			<p class="text-center" style="color: var(--text-muted);">
				No books match this collection's filters.
			</p>
		</div>
	{/if}
</section>
