<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { Folder, BookOpen, Star, Edit2, Trash2, AlertCircle } from 'lucide-svelte';
	import type { Genre } from '$lib/server/db/schema';

	// Genre colors (same as tags)
	const GENRE_COLORS = [
		{ name: 'Red', value: '#dc3545' },
		{ name: 'Orange', value: '#fd7e14' },
		{ name: 'Yellow', value: '#ffc107' },
		{ name: 'Green', value: '#28a745' },
		{ name: 'Teal', value: '#20c997' },
		{ name: 'Blue', value: '#007bff' },
		{ name: 'Indigo', value: '#6610f2' },
		{ name: 'Purple', value: '#6f42c1' },
		{ name: 'Pink', value: '#e83e8c' },
		{ name: 'Gray', value: '#6c757d' }
	];

	let {
		genre,
		books = [],
		mode = 'view',
		onClose,
		onSave,
		onDelete
	}: {
		genre: (Genre & { bookCount?: number; avgRating?: number | null }) | null;
		books?: { id: number; title: string; coverImageUrl: string | null; rating: number | null }[];
		mode: 'view' | 'edit' | 'add';
		onClose: () => void;
		onSave: (data: { name: string; description?: string | null; color?: string | null; icon?: string | null; displayOrder?: number }) => Promise<void>;
		onDelete?: () => Promise<void>;
	} = $props();

	let currentMode = $state(mode);
	let saving = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	// Form fields
	let name = $state(genre?.name || '');
	let description = $state(genre?.description || '');
	let color = $state(genre?.color || '');
	let icon = $state(genre?.icon || '');
	let displayOrder = $state(genre?.displayOrder ?? 0);

	async function handleSave() {
		if (!name.trim()) return;
		saving = true;
		try {
			await onSave({
				name: name.trim(),
				description: description.trim() || null,
				color: color || null,
				icon: icon.trim() || null,
				displayOrder
			});
			onClose();
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!onDelete) return;
		if (!confirm('Are you sure you want to delete this genre?')) return;
		deleting = true;
		deleteError = null;
		try {
			await onDelete();
			onClose();
		} catch (err) {
			if (err instanceof Error) {
				deleteError = err.message;
			} else {
				deleteError = 'Failed to delete genre';
			}
		} finally {
			deleting = false;
		}
	}
</script>

<Modal open={true} onClose={onClose} title={currentMode === 'add' ? 'Add Genre' : genre?.name || 'Genre'} size="md">
	{#if currentMode === 'view' && genre}
		<!-- View Mode -->
		<div class="p-6 space-y-6">
			<div class="flex items-center gap-4">
				<div
					class="w-16 h-16 rounded-lg flex items-center justify-center"
					style="background-color: {genre.color || '#6c757d'}20"
				>
					<Folder class="w-8 h-8" style="color: {genre.color || '#6c757d'}" />
				</div>

				<div class="flex-1">
					<h2 class="text-xl font-semibold" style="color: var(--text-primary);">{genre.name}</h2>
					<div class="flex items-center gap-3 mt-1 text-sm" style="color: var(--text-muted);">
						<span class="flex items-center gap-1">
							<BookOpen class="w-4 h-4" />
							{genre.bookCount ?? books.length} {(genre.bookCount ?? books.length) === 1 ? 'book' : 'books'}
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
						class="w-8 h-8 rounded-full shadow"
						style="background-color: {genre.color}; border: 4px solid var(--bg-secondary);"
					></div>
				{/if}
			</div>

			{#if genre.description}
				<div>
					<h3 class="text-sm font-medium mb-2" style="color: var(--text-secondary);">Description</h3>
					<p style="color: var(--text-muted);">{genre.description}</p>
				</div>
			{/if}

			{#if books.length > 0}
				<div>
					<h3 class="text-sm font-medium mb-3 flex items-center gap-2" style="color: var(--text-secondary);">
						<BookOpen class="w-4 h-4" />
						Books in this genre
					</h3>
					<div class="grid grid-cols-4 sm:grid-cols-6 gap-3">
						{#each books.slice(0, 12) as book}
							<a href="/books?id={book.id}" class="block">
								<img
									src={book.coverImageUrl || '/placeholder.png'}
									alt={book.title}
									class="w-full aspect-[2/3] object-cover rounded shadow-sm hover:shadow-md transition-shadow"
									onerror={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
								/>
							</a>
						{/each}
					</div>
					{#if books.length > 12}
						<p class="text-sm mt-2" style="color: var(--text-muted);">and {books.length - 12} more...</p>
					{/if}
				</div>
			{/if}

			{#if deleteError}
				<div class="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
					<AlertCircle class="w-4 h-4 flex-shrink-0" />
					<span>{deleteError}</span>
				</div>
			{/if}

			<!-- Action buttons -->
			<div class="flex justify-between pt-4" style="border-top: 1px solid var(--border-color);">
				<button
					type="button"
					class="btn-ghost px-4 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
					onclick={handleDelete}
					disabled={deleting}
				>
					<Trash2 class="w-4 h-4" />
					Delete
				</button>
				<button
					type="button"
					class="btn-accent flex items-center gap-2"
					onclick={() => { currentMode = 'edit'; deleteError = null; }}
				>
					<Edit2 class="w-4 h-4" />
					Edit
				</button>
			</div>
		</div>
	{:else}
		<!-- Edit/Add Mode -->
		<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="p-6 space-y-4">
			<div>
				<label for="name" class="label">Name <span class="text-red-500">*</span></label>
				<input
					id="name"
					type="text"
					bind:value={name}
					required
					class="input"
				/>
			</div>

			<div>
				<label for="description" class="label">Description</label>
				<textarea
					id="description"
					bind:value={description}
					rows="3"
					class="input"
				></textarea>
			</div>

			<div>
				<label class="label">Color</label>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
						style="background-color: var(--bg-secondary); border: 2px solid {!color ? 'var(--accent)' : 'var(--border-color)'}; {!color ? 'box-shadow: 0 0 0 2px var(--accent);' : ''}"
						title="No color"
						onclick={() => color = ''}
					>
						<span style="color: var(--text-muted);" class="text-xs">×</span>
					</button>
					{#each GENRE_COLORS as c}
						<button
							type="button"
							class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
							style="background-color: {c.value}; border-color: var(--bg-secondary); {color === c.value ? 'box-shadow: 0 0 0 2px var(--accent); transform: scale(1.1);' : ''}"
							title={c.name}
							onclick={() => color = c.value}
						></button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="icon" class="label">Icon</label>
					<input
						id="icon"
						type="text"
						bind:value={icon}
						placeholder="e.g., fas fa-book"
						class="input"
					/>
				</div>
				<div>
					<label for="displayOrder" class="label">Display Order</label>
					<input
						id="displayOrder"
						type="number"
						bind:value={displayOrder}
						min="0"
						class="input"
					/>
				</div>
			</div>

			<!-- Form buttons -->
			<div class="flex justify-end gap-3 pt-4" style="border-top: 1px solid var(--border-color);">
				<button
					type="button"
					class="btn-secondary"
					onclick={() => currentMode === 'add' ? onClose() : currentMode = 'view'}
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={saving || !name.trim()}
					class="btn-accent"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</form>
	{/if}
</Modal>
