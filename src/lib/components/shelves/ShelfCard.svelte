<script lang="ts">
	import { Bookmark, Edit, Trash2, Library } from 'lucide-svelte';

	import type { FilterConfig } from '$lib/server/services/magicShelfService';

	interface Shelf {
		id: number;
		name: string;
		description: string | null;
		icon: string | null;
		iconColor: string | null;
		filterJson: FilterConfig;
		sortField: string;
		sortOrder: string;
		isPublic: boolean;
		bookCount: number;
	}

	let {
		shelf,
		onEdit,
		onDelete
	}: {
		shelf: Shelf;
		onEdit?: (shelf: Shelf) => void;
		onDelete?: (shelf: Shelf) => void;
	} = $props();
</script>

<a
	href="/shelves/{shelf.id}"
	class="block p-4 rounded-xl border transition-all hover:shadow-lg group"
	style="background-color: var(--bg-secondary); border-color: var(--border-color);"
>
	<div class="flex items-start justify-between">
		<div class="flex items-center gap-3">
			<div
				class="w-10 h-10 rounded-lg flex items-center justify-center"
				style="background-color: {shelf.iconColor || '#6c757d'}20;"
			>
				<Library
					class="w-5 h-5"
					style="color: {shelf.iconColor || '#6c757d'};"
				/>
			</div>
			<div>
				<h3 class="font-semibold" style="color: var(--text-primary);">
					{shelf.name}
				</h3>
				{#if shelf.description}
					<p class="text-sm line-clamp-1" style="color: var(--text-muted);">
						{shelf.description}
					</p>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
			{#if onEdit}
				<button
					type="button"
					class="p-1.5 rounded hover:bg-black/10 transition-colors"
					style="color: var(--text-muted);"
					onclick={(e) => { e.preventDefault(); onEdit(shelf); }}
					title="Edit shelf"
				>
					<Edit class="w-4 h-4" />
				</button>
			{/if}
			{#if onDelete}
				<button
					type="button"
					class="p-1.5 rounded hover:bg-red-500/20 transition-colors"
					style="color: var(--text-muted);"
					onclick={(e) => { e.preventDefault(); onDelete(shelf); }}
					title="Delete shelf"
				>
					<Trash2 class="w-4 h-4" />
				</button>
			{/if}
		</div>
	</div>

	<div class="mt-3 flex items-center justify-between">
		<span class="text-sm" style="color: var(--text-muted);">
			{shelf.bookCount} book{shelf.bookCount !== 1 ? 's' : ''}
		</span>
		{#if shelf.isPublic}
			<span
				class="text-xs px-2 py-0.5 rounded-full"
				style="background-color: var(--accent-muted); color: var(--accent);"
			>
				Public
			</span>
		{/if}
	</div>
</a>
