<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import IconPicker from '$lib/components/ui/IconPicker.svelte';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';
	import { BookOpen, Edit2, Trash2, AlertCircle, ArrowRight } from 'lucide-svelte';

	// Common format-related icons
	const FORMAT_ICONS = [
		'book', 'book-open', 'book-copy', 'book-marked', 'book-text', 'book-open-check',
		'headphones', 'headset', 'disc', 'disc-2', 'disc-3',
		'tablet', 'smartphone', 'laptop', 'monitor',
		'file', 'file-text', 'file-audio', 'file-video',
		'library', 'scroll', 'newspaper', 'album', 'package'
	] as const;

	let {
		format,
		books = [],
		allFormats = [],
		mode = 'view',
		onClose,
		onSave,
		onDelete
	}: {
		format: { id: number; name: string; icon?: string | null; color?: string | null; bookCount?: number; createdAt: string | null; updatedAt: string | null } | null;
		books?: { id: number; title: string; coverImageUrl: string | null }[];
		allFormats?: { id: number; name: string }[];
		mode: 'view' | 'edit' | 'add';
		onClose: () => void;
		onSave: (data: { name: string; icon?: string; color?: string }) => Promise<void>;
		onDelete?: (reassignTo: number | null) => Promise<void>;
	} = $props();

	let currentMode = $state(mode);
	let saving = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);
	let showDeleteConfirm = $state(false);
	let reassignToId = $state<string>('null'); // 'null' for no format, or format id as string

	let name = $state(format?.name || '');
	let icon = $state(format?.icon || 'book');
	let color = $state(format?.color || '#6c757d');

	// Get formats available for reassignment (exclude current format)
	const reassignOptions = $derived(
		allFormats.filter(f => f.id !== format?.id)
	);

	const bookCount = $derived(format?.bookCount ?? books.length);

	async function handleSave() {
		if (!name.trim()) return;
		saving = true;
		try {
			await onSave({ name: name.trim(), icon, color });
			onClose();
		} finally {
			saving = false;
		}
	}

	function initiateDelete() {
		deleteError = null;
		if (bookCount > 0) {
			// Show reassignment dialog
			showDeleteConfirm = true;
		} else {
			// No books, confirm and delete directly
			if (confirm('Are you sure you want to delete this format?')) {
				performDelete(null);
			}
		}
	}

	async function performDelete(reassignTo: number | null) {
		if (!onDelete) return;
		deleting = true;
		deleteError = null;
		try {
			await onDelete(reassignTo);
			onClose();
		} catch (err) {
			if (err instanceof Error) {
				deleteError = err.message;
			} else {
				deleteError = 'Failed to delete format';
			}
			showDeleteConfirm = false;
		} finally {
			deleting = false;
		}
	}

	function confirmDelete() {
		const targetId = reassignToId === 'null' ? null : parseInt(reassignToId);
		performDelete(targetId);
	}
</script>

<Modal open={true} onClose={onClose} title={currentMode === 'add' ? 'Add Format' : format?.name || 'Format'} size="sm">
	{#if showDeleteConfirm && format}
		<!-- Delete Confirmation with Reassignment -->
		<div class="p-6 space-y-4">
			<div class="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
				<AlertCircle class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
				<div>
					<p class="font-medium text-amber-800 dark:text-amber-300">This format has {bookCount} book{bookCount === 1 ? '' : 's'}</p>
					<p class="text-sm text-amber-700 dark:text-amber-400 mt-1">Choose what to do with the books before deleting.</p>
				</div>
			</div>

			<div>
				<label for="reassignTo" class="label">
					Reassign books to:
				</label>
				<select
					id="reassignTo"
					bind:value={reassignToId}
					class="select"
				>
					<option value="null">No format (remove format from books)</option>
					{#each reassignOptions as fmt}
						<option value={fmt.id.toString()}>{fmt.name}</option>
					{/each}
				</select>
			</div>

			<div class="flex items-center gap-2 text-sm" style="color: var(--text-muted);">
				<span class="font-medium">{format.name}</span>
				<ArrowRight class="w-4 h-4" />
				<span class="font-medium">
					{reassignToId === 'null' ? 'No format' : reassignOptions.find(f => f.id.toString() === reassignToId)?.name || 'Unknown'}
				</span>
			</div>

			{#if deleteError}
				<div class="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
					<AlertCircle class="w-4 h-4 flex-shrink-0" />
					<span>{deleteError}</span>
				</div>
			{/if}

			<div class="flex justify-end gap-3 pt-4" style="border-top: 1px solid var(--border-color);">
				<button
					type="button"
					class="btn-secondary"
					onclick={() => showDeleteConfirm = false}
					disabled={deleting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn-danger flex items-center gap-2"
					onclick={confirmDelete}
					disabled={deleting}
				>
					<Trash2 class="w-4 h-4" />
					{deleting ? 'Deleting...' : 'Delete Format'}
				</button>
			</div>
		</div>
	{:else if currentMode === 'view' && format}
		<!-- View Mode -->
		<div class="p-6 space-y-6">
			<div class="flex items-center gap-4">
				<div
					class="w-16 h-16 rounded-lg flex items-center justify-center"
					style="background-color: {format.color || '#6c757d'}20;"
				>
					<LucideIcon name={format.icon || 'book'} size={32} color={format.color || '#6c757d'} />
				</div>

				<div class="flex-1">
					<h2 class="text-xl font-semibold" style="color: var(--text-primary);">{format.name}</h2>
					<p class="text-sm flex items-center gap-1 mt-1" style="color: var(--text-muted);">
						<BookOpen class="w-4 h-4" />
						{bookCount} {bookCount === 1 ? 'book' : 'books'}
					</p>
				</div>
			</div>

			{#if books.length > 0}
				<div>
					<h3 class="text-sm font-medium mb-3 flex items-center gap-2" style="color: var(--text-secondary);">
						<BookOpen class="w-4 h-4" />
						Books in this format
					</h3>
					<div class="grid grid-cols-4 sm:grid-cols-6 gap-3">
						{#each books.slice(0, 12) as book}
							<a href="/books/{book.id}" class="block">
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
					onclick={initiateDelete}
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
					placeholder="e.g., Hardcover, Paperback, Ebook, Audiobook"
					class="input"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="label">Icon</label>
					<IconPicker icons={FORMAT_ICONS} bind:value={icon} placeholder="Select icon..." />
				</div>

				<div>
					<label for="color" class="label">Color</label>
					<div class="flex items-center gap-2">
						<input
							id="color"
							type="color"
							bind:value={color}
							class="w-10 h-10 rounded cursor-pointer"
							style="border: 1px solid var(--border-color);"
						/>
						<input
							type="text"
							bind:value={color}
							placeholder="#6c757d"
							class="input flex-1"
						/>
					</div>
				</div>
			</div>

			<!-- Preview -->
			<div class="p-4 rounded-lg card">
				<p class="text-xs mb-2" style="color: var(--text-muted);">Preview</p>
				<div class="flex items-center gap-3">
					<div
						class="w-10 h-10 rounded-lg flex items-center justify-center"
						style="background-color: {color}20;"
					>
						<LucideIcon name={icon} size={20} {color} />
					</div>
					<span class="font-medium" style="color: var(--text-primary);">{name || 'Format Name'}</span>
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
