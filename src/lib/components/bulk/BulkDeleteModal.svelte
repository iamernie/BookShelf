<script lang="ts">
	import { X, Trash2, AlertTriangle } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let {
		bookIds,
		bookTitles = [],
		onClose,
		onComplete
	}: {
		bookIds: number[];
		bookTitles?: string[];
		onClose: () => void;
		onComplete: () => void;
	} = $props();

	let loading = $state(false);
	let confirmText = $state('');

	const requiredConfirm = 'DELETE';
	const isConfirmed = $derived(confirmText === requiredConfirm);

	async function handleDelete() {
		if (!isConfirmed) {
			toasts.warning(`Please type "${requiredConfirm}" to confirm`);
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/books/bulk/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bookIds })
			});

			if (res.ok) {
				const result = await res.json();
				toasts.success(`Deleted ${result.deleted} book(s)`);
				onComplete();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to delete books');
			}
		} catch (e) {
			toasts.error('Failed to delete books');
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
				<Trash2 class="w-5 h-5 text-red-500" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					Delete {bookIds.length} Book{bookIds.length !== 1 ? 's' : ''}
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

		<!-- Content -->
		<div class="p-4">
			<!-- Warning -->
			<div class="flex gap-3 p-3 rounded-lg mb-4 bg-red-500/10 border border-red-500/20">
				<AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
				<div>
					<p class="text-sm font-medium text-red-600 dark:text-red-400">
						This action cannot be undone!
					</p>
					<p class="text-sm mt-1" style="color: var(--text-secondary);">
						This will permanently delete {bookIds.length} book{bookIds.length !== 1 ? 's' : ''} and their associated data (covers, ebook files, reading progress).
					</p>
				</div>
			</div>

			<!-- Book list preview -->
			{#if bookTitles.length > 0}
				<div class="mb-4">
					<p class="text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Books to delete:
					</p>
					<div class="max-h-32 overflow-y-auto rounded border p-2" style="border-color: var(--border-color); background-color: var(--bg-tertiary);">
						{#each bookTitles.slice(0, 10) as title, i (i)}
							<p class="text-sm truncate" style="color: var(--text-primary);">
								{title}
							</p>
						{/each}
						{#if bookTitles.length > 10}
							<p class="text-sm" style="color: var(--text-muted);">
								...and {bookTitles.length - 10} more
							</p>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Confirmation input -->
			<div>
				<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
					Type <span class="font-mono font-bold text-red-500">{requiredConfirm}</span> to confirm:
				</label>
				<input
					type="text"
					class="input w-full"
					bind:value={confirmText}
					placeholder="Type DELETE to confirm"
				/>
			</div>
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
				class="px-4 py-2 rounded-lg font-medium transition-colors bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={handleDelete}
				disabled={loading || !isConfirmed}
			>
				{#if loading}
					Deleting...
				{:else}
					Delete {bookIds.length} Book{bookIds.length !== 1 ? 's' : ''}
				{/if}
			</button>
		</div>
	</div>
</div>
