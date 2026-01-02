<script lang="ts">
	import { X, Tag, Plus, Minus } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	interface TagItem {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
		isSystem: boolean | null;
	}

	let {
		bookIds,
		tags,
		onClose,
		onComplete
	}: {
		bookIds: number[];
		tags: TagItem[];
		onClose: () => void;
		onComplete: () => void;
	} = $props();

	let mode = $state<'add' | 'remove'>('add');
	let selectedTagIds = $state<Set<number>>(new Set());
	let loading = $state(false);

	function toggleTag(tagId: number) {
		const newSet = new Set(selectedTagIds);
		if (newSet.has(tagId)) {
			newSet.delete(tagId);
		} else {
			newSet.add(tagId);
		}
		selectedTagIds = newSet;
	}

	async function handleSubmit() {
		if (selectedTagIds.size === 0) {
			toasts.warning('Please select at least one tag');
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/books/bulk/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookIds,
					tagIds: Array.from(selectedTagIds),
					action: mode
				})
			});

			if (res.ok) {
				const result = await res.json();
				toasts.success(`Tags ${mode === 'add' ? 'added to' : 'removed from'} ${result.updated} book(s)`);
				onComplete();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to update tags');
			}
		} catch (e) {
			toasts.error('Failed to update tags');
		} finally {
			loading = false;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	role="dialog"
	aria-modal="true"
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<!-- Backdrop -->
	<button
		type="button"
		class="absolute inset-0 bg-black/50"
		onclick={onClose}
		aria-label="Close modal"
	></button>

	<!-- Modal -->
	<div
		class="relative w-full max-w-md rounded-xl shadow-2xl border"
		style="background-color: var(--bg-secondary); border-color: var(--border-color);"
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b" style="border-color: var(--border-color);">
			<div class="flex items-center gap-2">
				<Tag class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					Manage Tags for {bookIds.length} Book{bookIds.length !== 1 ? 's' : ''}
				</h2>
			</div>
			<button
				type="button"
				class="p-1 rounded hover:bg-black/10 transition-colors"
				style="color: var(--text-muted);"
				onclick={onClose}
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<!-- Mode Toggle -->
		<div class="p-4 border-b" style="border-color: var(--border-color);">
			<div class="flex rounded-lg p-1" style="background-color: var(--bg-tertiary);">
				<button
					type="button"
					class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors"
					style="background-color: {mode === 'add' ? 'var(--bg-secondary)' : 'transparent'}; color: {mode === 'add' ? 'var(--accent)' : 'var(--text-muted)'};"
					onclick={() => mode = 'add'}
				>
					<Plus class="w-4 h-4" />
					Add Tags
				</button>
				<button
					type="button"
					class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors"
					style="background-color: {mode === 'remove' ? 'var(--bg-secondary)' : 'transparent'}; color: {mode === 'remove' ? 'var(--accent)' : 'var(--text-muted)'};"
					onclick={() => mode = 'remove'}
				>
					<Minus class="w-4 h-4" />
					Remove Tags
				</button>
			</div>
		</div>

		<!-- Tag List -->
		<div class="p-4 max-h-80 overflow-y-auto">
			{#if tags.length === 0}
				<p class="text-center py-4" style="color: var(--text-muted);">
					No tags available. Create some tags first.
				</p>
			{:else}
				<div class="grid grid-cols-2 gap-2">
					{#each tags as tag (tag.id)}
						<button
							type="button"
							class="flex items-center gap-2 p-2 rounded-lg border transition-all text-left"
							style="
								border-color: {selectedTagIds.has(tag.id) ? tag.color || 'var(--accent)' : 'var(--border-color)'};
								background-color: {selectedTagIds.has(tag.id) ? (tag.color ? tag.color + '20' : 'var(--accent-muted)') : 'transparent'};
							"
							onclick={() => toggleTag(tag.id)}
						>
							<div
								class="w-3 h-3 rounded-full flex-shrink-0"
								style="background-color: {tag.color || '#6c757d'};"
							></div>
							<span
								class="text-sm truncate"
								style="color: {selectedTagIds.has(tag.id) ? 'var(--text-primary)' : 'var(--text-secondary)'};"
							>
								{tag.name}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex justify-end gap-3 p-4 border-t" style="border-color: var(--border-color);">
			<button
				type="button"
				class="btn-ghost px-4 py-2"
				onclick={onClose}
				disabled={loading}
			>
				Cancel
			</button>
			<button
				type="button"
				class="btn-accent px-4 py-2"
				onclick={handleSubmit}
				disabled={loading || selectedTagIds.size === 0}
			>
				{#if loading}
					Updating...
				{:else}
					{mode === 'add' ? 'Add' : 'Remove'} {selectedTagIds.size} Tag{selectedTagIds.size !== 1 ? 's' : ''}
				{/if}
			</button>
		</div>
	</div>
</div>
