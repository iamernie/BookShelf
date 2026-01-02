<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { Tag, BookOpen, Library, Edit2, Trash2, Lock, AlertTriangle } from 'lucide-svelte';
	import type { Tag as TagType } from '$lib/server/db/schema';

	interface TagColor {
		name: string;
		value: string;
	}

	let {
		tag,
		books = [],
		series = [],
		colors = [],
		mode = 'view',
		onClose,
		onSave,
		onDelete
	}: {
		tag: (TagType & { bookCount?: number; seriesCount?: number }) | null;
		books?: { id: number; title: string; coverImageUrl: string | null }[];
		series?: { id: number; title: string }[];
		colors: TagColor[];
		mode: 'view' | 'edit' | 'add';
		onClose: () => void;
		onSave: (data: { name?: string; color?: string; icon?: string | null }) => Promise<void>;
		onDelete?: () => Promise<void>;
	} = $props();

	let currentMode = $state(mode);
	let saving = $state(false);
	let deleting = $state(false);

	// Form fields
	let name = $state(tag?.name || '');
	let color = $state(tag?.color || '#6c757d');
	let icon = $state(tag?.icon || '');

	const isSystem = tag?.isSystem ?? false;

	async function handleSave() {
		if (!isSystem && !name.trim()) return;
		saving = true;
		try {
			await onSave({
				name: isSystem ? undefined : name.trim(),
				color,
				icon: icon.trim() || null
			});
			onClose();
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!onDelete) return;
		if (isSystem) {
			alert('System tags cannot be deleted');
			return;
		}
		if (!confirm('Are you sure you want to delete this tag? This will remove it from all books and series.')) return;
		deleting = true;
		try {
			await onDelete();
			onClose();
		} finally {
			deleting = false;
		}
	}

	function getIconPreview(iconName: string, colorValue: string) {
		if (iconName === 'heart') return { type: 'heart', color: colorValue };
		if (iconName === 'star') return { type: 'star', color: colorValue };
		return { type: 'tag', color: colorValue };
	}

	let iconPreview = $derived(getIconPreview(icon, color));
</script>

<Modal open={true} onClose={onClose} title={currentMode === 'add' ? 'Add Tag' : tag?.name || 'Tag'} size="md">
	{#if currentMode === 'view' && tag}
		<!-- View Mode -->
		<div class="p-6 space-y-6">
			<div class="flex items-center gap-4">
				<div
					class="w-16 h-16 rounded-lg flex items-center justify-center"
					style="background-color: {tag.color || '#6c757d'}20"
				>
					{#if tag.icon === 'heart'}
						<svg class="w-8 h-8" style="color: {tag.color || '#6c757d'}" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
						</svg>
					{:else if tag.icon === 'star'}
						<svg class="w-8 h-8" style="color: {tag.color || '#6c757d'}" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
						</svg>
					{:else}
						<Tag class="w-8 h-8" style="color: {tag.color || '#6c757d'}" />
					{/if}
				</div>

				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h2 class="text-xl font-semibold" style="color: var(--text-primary);">{tag.name}</h2>
						{#if isSystem}
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style="background-color: var(--bg-tertiary); color: var(--text-muted);">
								<Lock class="w-3 h-3" />
								System
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-3 mt-1 text-sm" style="color: var(--text-muted);">
						<span class="flex items-center gap-1">
							<BookOpen class="w-4 h-4" />
							{tag.bookCount ?? books.length} {(tag.bookCount ?? books.length) === 1 ? 'book' : 'books'}
						</span>
						{#if (tag.seriesCount ?? series.length) > 0}
							<span class="flex items-center gap-1">
								<Library class="w-4 h-4" />
								{tag.seriesCount ?? series.length} series
							</span>
						{/if}
					</div>
				</div>

				<div
					class="w-8 h-8 rounded-full shadow"
					style="background-color: {tag.color || '#6c757d'}; border: 4px solid var(--bg-secondary);"
				></div>
			</div>

			{#if books.length > 0}
				<div>
					<h3 class="text-sm font-medium mb-3 flex items-center gap-2" style="color: var(--text-secondary);">
						<BookOpen class="w-4 h-4" />
						Books with this tag
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

			{#if series.length > 0}
				<div>
					<h3 class="text-sm font-medium mb-3 flex items-center gap-2" style="color: var(--text-secondary);">
						<Library class="w-4 h-4" />
						Series with this tag
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each series as s}
							<a
								href="/series?id={s.id}"
								class="px-3 py-1.5 rounded-lg text-sm transition-colors"
								style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
								onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
								onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
							>
								{s.title}
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Action buttons -->
			<div class="flex justify-between pt-4" style="border-top: 1px solid var(--border-color);">
				{#if isSystem}
					<div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
						<AlertTriangle class="w-4 h-4" />
						System tags can't be deleted or renamed
					</div>
				{:else}
					<button
						type="button"
						class="btn-ghost px-4 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
						onclick={handleDelete}
						disabled={deleting}
					>
						<Trash2 class="w-4 h-4" />
						Delete
					</button>
				{/if}
				<button
					type="button"
					class="btn-accent flex items-center gap-2"
					onclick={() => currentMode = 'edit'}
				>
					<Edit2 class="w-4 h-4" />
					Edit
				</button>
			</div>
		</div>
	{:else}
		<!-- Edit/Add Mode -->
		<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="p-6 space-y-4">
			{#if isSystem && currentMode === 'edit'}
				<div class="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
					<Lock class="w-4 h-4 flex-shrink-0" />
					<span>System tags can only have their color and icon changed. The name cannot be modified.</span>
				</div>
			{/if}

			<div>
				<label for="name" class="label">
					Name {#if !isSystem}<span class="text-red-500">*</span>{/if}
				</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					required={!isSystem}
					disabled={isSystem}
					class="input"
					class:opacity-50={isSystem}
					class:cursor-not-allowed={isSystem}
				/>
			</div>

			<div>
				<label class="label">Color</label>
				<div class="flex flex-wrap gap-2">
					{#each colors as c}
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

			<div>
				<label for="icon" class="label">Icon (optional)</label>
				<div class="flex gap-3">
					<input
						id="icon"
						type="text"
						bind:value={icon}
						placeholder="e.g., heart, star"
						class="input flex-1"
					/>
					<div
						class="w-10 h-10 rounded-lg flex items-center justify-center"
						style="background-color: {color}20"
					>
						{#if iconPreview.type === 'heart'}
							<svg class="w-5 h-5" style="color: {iconPreview.color}" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
							</svg>
						{:else if iconPreview.type === 'star'}
							<svg class="w-5 h-5" style="color: {iconPreview.color}" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
							</svg>
						{:else}
							<Tag class="w-5 h-5" style="color: {iconPreview.color}" />
						{/if}
					</div>
				</div>
				<p class="text-xs mt-1" style="color: var(--text-muted);">Supported icons: heart, star. Leave empty for default tag icon.</p>
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
					disabled={saving || (!isSystem && !name.trim())}
					class="btn-accent"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</form>
	{/if}
</Modal>
