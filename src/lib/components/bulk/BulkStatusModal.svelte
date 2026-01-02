<script lang="ts">
	import { X, CheckCircle } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	interface StatusItem {
		id: number;
		name: string;
		color: string | null;
	}

	let {
		bookIds,
		statuses,
		onClose,
		onComplete
	}: {
		bookIds: number[];
		statuses: StatusItem[];
		onClose: () => void;
		onComplete: () => void;
	} = $props();

	let selectedStatusId = $state<number | null>(null);
	let loading = $state(false);

	async function handleSubmit() {
		if (selectedStatusId === null) {
			toasts.warning('Please select a status');
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/books/bulk/status', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookIds,
					statusId: selectedStatusId
				})
			});

			if (res.ok) {
				const result = await res.json();
				toasts.success(`Status updated for ${result.updated} book(s)`);
				onComplete();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to update status');
			}
		} catch (e) {
			toasts.error('Failed to update status');
		} finally {
			loading = false;
		}
	}

	const selectedStatus = $derived(statuses.find(s => s.id === selectedStatusId));
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
		class="relative w-full max-w-sm rounded-xl shadow-2xl border"
		style="background-color: var(--bg-secondary); border-color: var(--border-color);"
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b" style="border-color: var(--border-color);">
			<div class="flex items-center gap-2">
				<CheckCircle class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					Change Status
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

		<!-- Status List -->
		<div class="p-4">
			<p class="text-sm mb-4" style="color: var(--text-secondary);">
				Select a status to apply to {bookIds.length} book{bookIds.length !== 1 ? 's' : ''}:
			</p>

			<div class="space-y-2">
				{#each statuses as status (status.id)}
					<button
						type="button"
						class="w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left"
						style="
							border-color: {selectedStatusId === status.id ? status.color || 'var(--accent)' : 'var(--border-color)'};
							background-color: {selectedStatusId === status.id ? (status.color ? status.color + '15' : 'var(--accent-muted)') : 'transparent'};
						"
						onclick={() => selectedStatusId = status.id}
					>
						<div
							class="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
							style="background-color: {status.color || '#6c757d'};"
						>
							{#if selectedStatusId === status.id}
								<CheckCircle class="w-3 h-3 text-white" />
							{/if}
						</div>
						<span
							class="font-medium"
							style="color: {selectedStatusId === status.id ? 'var(--text-primary)' : 'var(--text-secondary)'};"
						>
							{status.name}
						</span>
					</button>
				{/each}
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
				class="btn-accent px-4 py-2"
				onclick={handleSubmit}
				disabled={loading || selectedStatusId === null}
			>
				{#if loading}
					Updating...
				{:else if selectedStatus}
					Set to "{selectedStatus.name}"
				{:else}
					Apply Status
				{/if}
			</button>
		</div>
	</div>
</div>
