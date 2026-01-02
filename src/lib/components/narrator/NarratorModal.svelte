<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { Mic, BookOpen, Star, Edit2, Trash2, AlertCircle, ExternalLink } from 'lucide-svelte';

	let {
		narrator,
		books = [],
		mode = 'view',
		onClose,
		onSave,
		onDelete
	}: {
		narrator: { id: number; name: string; bio: string | null; url: string | null; bookCount?: number; avgRating?: number | null; createdAt: string | null; updatedAt: string | null } | null;
		books?: { id: number; title: string; coverImageUrl: string | null; rating: number | null }[];
		mode: 'view' | 'edit' | 'add';
		onClose: () => void;
		onSave: (data: { name: string; bio?: string | null; url?: string | null }) => Promise<void>;
		onDelete?: () => Promise<void>;
	} = $props();

	let currentMode = $state(mode);
	let saving = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	let name = $state(narrator?.name || '');
	let bio = $state(narrator?.bio || '');
	let url = $state(narrator?.url || '');

	async function handleSave() {
		if (!name.trim()) return;
		saving = true;
		try {
			await onSave({
				name: name.trim(),
				bio: bio.trim() || null,
				url: url.trim() || null
			});
			onClose();
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!onDelete) return;
		if (!confirm('Are you sure you want to delete this narrator?')) return;
		deleting = true;
		deleteError = null;
		try {
			await onDelete();
			onClose();
		} catch (err) {
			if (err instanceof Error) {
				deleteError = err.message;
			} else {
				deleteError = 'Failed to delete narrator';
			}
		} finally {
			deleting = false;
		}
	}
</script>

<Modal open={true} onClose={onClose} title={currentMode === 'add' ? 'Add Narrator' : narrator?.name || 'Narrator'} size="md">
	{#if currentMode === 'view' && narrator}
		<!-- View Mode -->
		<div class="p-6 space-y-6">
			<div class="flex items-center gap-4">
				<div class="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
					<Mic class="w-8 h-8 text-purple-600 dark:text-purple-400" />
				</div>

				<div class="flex-1">
					<h2 class="text-xl font-semibold" style="color: var(--text-primary);">{narrator.name}</h2>
					<div class="flex items-center gap-3 mt-1 text-sm" style="color: var(--text-muted);">
						<span class="flex items-center gap-1">
							<BookOpen class="w-4 h-4" />
							{narrator.bookCount ?? books.length} {(narrator.bookCount ?? books.length) === 1 ? 'book' : 'books'}
						</span>
						{#if narrator.avgRating}
							<span class="flex items-center gap-1">
								<Star class="w-4 h-4 fill-yellow-400 text-yellow-400" />
								{narrator.avgRating}
							</span>
						{/if}
					</div>
				</div>
			</div>

			{#if narrator.url}
				<a href={narrator.url} target="_blank" rel="noopener" class="text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-2 text-sm">
					<ExternalLink class="w-4 h-4" />
					View Profile
				</a>
			{/if}

			{#if narrator.bio}
				<div>
					<h3 class="text-sm font-medium mb-2" style="color: var(--text-secondary);">Biography</h3>
					<p class="whitespace-pre-wrap" style="color: var(--text-muted);">{narrator.bio}</p>
				</div>
			{/if}

			{#if books.length > 0}
				<div>
					<h3 class="text-sm font-medium mb-3 flex items-center gap-2" style="color: var(--text-secondary);">
						<BookOpen class="w-4 h-4" />
						Audiobooks narrated
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
				<label for="bio" class="label">Biography</label>
				<textarea
					id="bio"
					bind:value={bio}
					rows="4"
					class="input"
				></textarea>
			</div>

			<div>
				<label for="url" class="label">Profile URL</label>
				<input
					id="url"
					type="url"
					bind:value={url}
					placeholder="https://..."
					class="input"
				/>
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
