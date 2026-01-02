<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { BookOpen, Edit2, AlertTriangle, Lock } from 'lucide-svelte';

	let {
		status,
		books = [],
		mode = 'view',
		onClose,
		onSave
	}: {
		status: { id: number; name: string; key: string | null; color: string | null; icon: string | null; isSystem: boolean | null; sortOrder: number | null; bookCount?: number; createdAt: string | null; updatedAt: string | null } | null;
		books?: { id: number; title: string; coverImageUrl: string | null }[];
		mode: 'view' | 'edit';
		onClose: () => void;
		onSave: (data: { name: string }) => Promise<void>;
	} = $props();

	let currentMode = $state(mode);
	let saving = $state(false);

	let name = $state(status?.name || '');

	async function handleSave() {
		if (!name.trim()) return;
		saving = true;
		try {
			await onSave({ name: name.trim() });
			onClose();
		} finally {
			saving = false;
		}
	}
</script>

<Modal open={true} onClose={onClose} title={status?.name || 'Status'} size="md">
	{#if currentMode === 'view' && status}
		<!-- View Mode -->
		<div class="p-6 space-y-6">
			<div class="flex items-center gap-4">
				<div
					class="w-16 h-16 rounded-lg flex items-center justify-center"
					style="background-color: {status.color || '#6c757d'}20"
				>
					<div
						class="w-8 h-8 rounded-full"
						style="background-color: {status.color || '#6c757d'}"
					></div>
				</div>

				<div class="flex-1">
					<div class="flex items-center gap-2">
						<h2 class="text-xl font-semibold" style="color: var(--text-primary);">{status.name}</h2>
						{#if status.isSystem}
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style="background-color: var(--bg-tertiary); color: var(--text-muted);">
								<Lock class="w-3 h-3" />
								System
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-3 mt-1 text-sm" style="color: var(--text-muted);">
						<span class="flex items-center gap-1">
							<BookOpen class="w-4 h-4" />
							{status.bookCount ?? books.length} {(status.bookCount ?? books.length) === 1 ? 'book' : 'books'}
						</span>
						{#if status.key}
							<span style="color: var(--text-muted);">Key: {status.key}</span>
						{/if}
					</div>
				</div>

				<div
					class="w-8 h-8 rounded-full shadow"
					style="background-color: {status.color || '#6c757d'}; border: 4px solid var(--bg-secondary);"
				></div>
			</div>

			<div class="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
				<AlertTriangle class="w-4 h-4 flex-shrink-0" />
				<span>Statuses are system-defined. Only the display name can be changed for localization purposes.</span>
			</div>

			{#if books.length > 0}
				<div>
					<h3 class="text-sm font-medium mb-3 flex items-center gap-2" style="color: var(--text-secondary);">
						<BookOpen class="w-4 h-4" />
						Books with this status
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

			<!-- Action buttons -->
			<div class="flex justify-end pt-4" style="border-top: 1px solid var(--border-color);">
				<button
					type="button"
					class="btn-accent flex items-center gap-2"
					onclick={() => currentMode = 'edit'}
				>
					<Edit2 class="w-4 h-4" />
					Edit Name
				</button>
			</div>
		</div>
	{:else if status}
		<!-- Edit Mode -->
		<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="p-6 space-y-4">
			<div class="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
				<Lock class="w-4 h-4 flex-shrink-0" />
				<span>You can only change the display name for localization. The status key and behavior cannot be modified.</span>
			</div>

			<div>
				<label for="name" class="label">Display Name <span class="text-red-500">*</span></label>
				<input
					id="name"
					type="text"
					bind:value={name}
					required
					class="input"
				/>
				{#if status.key}
					<p class="text-xs mt-1" style="color: var(--text-muted);">System key: {status.key}</p>
				{/if}
			</div>

			<!-- Form buttons -->
			<div class="flex justify-end gap-3 pt-4" style="border-top: 1px solid var(--border-color);">
				<button
					type="button"
					class="btn-secondary"
					onclick={() => currentMode = 'view'}
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
