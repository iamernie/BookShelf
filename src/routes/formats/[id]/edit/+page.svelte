<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import {
		ArrowLeft,
		Loader2,
		Layers,
		BookOpen,
		Palette,
		Trash2,
		AlertCircle,
		ArrowRight
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import IconPicker from '$lib/components/ui/IconPicker.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	let { data } = $props();
	const format = data.format;

	// Get return URL from query params
	let returnTo = $derived($page.url.searchParams.get('returnTo') || `/formats`);

	let saving = $state(false);
	let deleting = $state(false);
	let showDeleteModal = $state(false);
	let reassignToId = $state<string>('null');

	// Form fields
	let name = $state(format.name || '');
	let color = $state(format.color || '#6b7280');
	let icon = $state(format.icon || 'book');

	// Icon picker state
	let showIconPicker = $state(false);

	// Get the target format name for display
	const reassignTargetName = $derived(
		reassignToId === 'null'
			? 'No format'
			: data.allFormats.find((f: { id: number; name: string }) => f.id.toString() === reassignToId)?.name || 'Unknown'
	);

	// Predefined colors
	const colorOptions = [
		'#ef4444', '#f97316', '#f59e0b', '#eab308',
		'#84cc16', '#22c55e', '#10b981', '#14b8a6',
		'#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
		'#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
		'#f43f5e', '#6b7280', '#78716c', '#71717a'
	];

	async function handleSave() {
		if (!name.trim()) return;
		saving = true;
		try {
			const res = await fetch(`/api/formats/${format.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					color: color || null,
					icon: icon || 'book'
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save format');
				return;
			}

			toasts.success('Format saved');
			await tick();
			goto(decodeURIComponent(returnTo));
		} finally {
			saving = false;
		}
	}

	function handleCancel() {
		goto(decodeURIComponent(returnTo));
	}

	function selectIcon(selectedIcon: string) {
		icon = selectedIcon;
		showIconPicker = false;
	}

	function initiateDelete() {
		if (format.bookCount > 0) {
			// Show reassignment dialog
			showDeleteModal = true;
		} else {
			// No books, confirm and delete directly
			if (confirm('Are you sure you want to delete this format?')) {
				performDelete(null);
			}
		}
	}

	async function performDelete(reassignTo: number | null) {
		deleting = true;
		try {
			const res = await fetch(`/api/formats/${format.id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reassignTo })
			});

			if (!res.ok) {
				const err = await res.json();
				toasts.error(err.message || 'Failed to delete format');
				return;
			}

			toasts.success('Format deleted');
			showDeleteModal = false;
			goto('/formats');
		} catch {
			toasts.error('Failed to delete format');
		} finally {
			deleting = false;
		}
	}

	function confirmDelete() {
		const targetId = reassignToId === 'null' ? null : parseInt(reassignToId);
		performDelete(targetId);
	}
</script>

<svelte:head>
	<title>Edit {format.name} - BookShelf</title>
</svelte:head>

<div class="min-h-full" style="background-color: var(--bg-primary);">
	<!-- Header -->
	<div
		class="sticky top-0 z-20"
		style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border-color);"
	>
		<div class="max-w-4xl mx-auto px-4 sm:px-6">
			<div class="flex items-center justify-between h-16">
				<button
					type="button"
					class="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
					style="color: var(--text-secondary);"
					onclick={handleCancel}
				>
					<ArrowLeft class="w-4 h-4" />
					<span class="hidden sm:inline">Back</span>
				</button>

				<h1 class="font-semibold truncate max-w-[200px] sm:max-w-md" style="color: var(--text-primary);">
					Edit Format
				</h1>

				<div class="flex items-center gap-2">
					<button
						type="button"
						class="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5"
						style="color: #ef4444;"
						onclick={initiateDelete}
						disabled={deleting}
					>
						<Trash2 class="w-4 h-4" />
						<span class="hidden sm:inline">Delete</span>
					</button>
					<button
						type="button"
						class="px-3 py-1.5 text-sm rounded-lg transition-colors"
						style="color: var(--text-muted);"
						onclick={handleCancel}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn-accent px-4 py-1.5 text-sm flex items-center gap-2"
						disabled={saving || !name.trim()}
						onclick={handleSave}
					>
						{#if saving}
							<Loader2 class="w-4 h-4 animate-spin" />
						{/if}
						Save
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-4xl mx-auto px-4 sm:px-6 py-6">
		<div class="flex gap-6">
			<!-- Sidebar with Preview and Stats -->
			<div class="hidden lg:block w-48 flex-shrink-0">
				<div class="sticky top-20 space-y-4">
					<!-- Format Preview -->
					<div
						class="rounded-lg p-4"
						style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
					>
						<div
							class="w-full aspect-square rounded-lg flex items-center justify-center mb-3"
							style="background-color: {color}20;"
						>
							<DynamicIcon {icon} size={48} {color} />
						</div>
						<p class="text-center text-sm font-medium" style="color: var(--text-primary);">
							{name || 'Format Name'}
						</p>
					</div>

					<!-- Stats Card -->
					<div
						class="rounded-lg p-4"
						style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
					>
						<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Stats</h3>
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--text-muted);">Books</span>
								<span class="text-sm font-medium" style="color: var(--text-primary);">
									{format.bookCount}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Main Form -->
			<div class="flex-1 min-w-0">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSave();
					}}
				>
					<div class="space-y-4">
						<!-- Name -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label for="name" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
								Name <span style="color: var(--accent);">*</span>
							</label>
							<input
								id="name"
								type="text"
								bind:value={name}
								required
								class="w-full px-3 py-2 rounded-md transition-all focus:ring-2 focus:ring-offset-0"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); --tw-ring-color: var(--accent);"
								placeholder="Format name (e.g., Hardcover, Paperback, Ebook)"
							/>
						</div>

						<!-- Color -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label class="block text-xs font-medium mb-3" style="color: var(--text-muted);">
								<Palette class="w-3.5 h-3.5 inline-block mr-1" />
								Color
							</label>
							<div class="flex flex-wrap gap-2">
								{#each colorOptions as colorOpt}
									<button
										type="button"
										class="w-8 h-8 rounded-lg transition-transform hover:scale-110"
										class:ring-2={color === colorOpt}
										class:ring-offset-2={color === colorOpt}
										style="background-color: {colorOpt}; --tw-ring-color: var(--accent);"
										onclick={() => color = colorOpt}
									></button>
								{/each}
							</div>
							<div class="mt-3 flex items-center gap-2">
								<label for="customColor" class="text-xs" style="color: var(--text-muted);">Custom:</label>
								<input
									id="customColor"
									type="color"
									bind:value={color}
									class="w-8 h-8 rounded cursor-pointer"
								/>
								<span class="text-xs font-mono" style="color: var(--text-secondary);">{color}</span>
							</div>
						</div>

						<!-- Icon -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label class="block text-xs font-medium mb-3" style="color: var(--text-muted);">
								Icon
							</label>
							<div class="flex items-center gap-3">
								<div
									class="w-12 h-12 rounded-lg flex items-center justify-center"
									style="background-color: var(--bg-tertiary);"
								>
									<DynamicIcon {icon} size={24} {color} />
								</div>
								<button
									type="button"
									class="px-3 py-1.5 text-sm rounded-lg transition-colors"
									style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
									onclick={() => showIconPicker = true}
								>
									Choose Icon
								</button>
								{#if icon && icon !== 'book'}
									<button
										type="button"
										class="px-3 py-1.5 text-sm rounded-lg transition-colors"
										style="color: var(--text-muted);"
										onclick={() => icon = 'book'}
									>
										Reset
									</button>
								{/if}
							</div>
						</div>

						<!-- Books in Format -->
						{#if data.books.length > 0}
							<div
								class="rounded-lg p-4"
								style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
							>
								<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
									<BookOpen class="w-3.5 h-3.5" />
									Books ({data.books.length})
								</h3>
								<div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
									{#each data.books as book}
										<a
											href="/books/{book.id}"
											class="flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors hover:opacity-80"
											style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
										>
											<img
												src={book.coverImageUrl || '/placeholder.png'}
												alt=""
												class="w-6 h-9 object-cover rounded"
												onerror={(e) => {
													(e.currentTarget as HTMLImageElement).src = '/placeholder.png';
												}}
											/>
											{book.title}
										</a>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</form>
			</div>
		</div>
	</div>
</div>

<!-- Icon Picker Modal -->
{#if showIconPicker}
	<IconPicker
		selectedIcon={icon}
		onSelect={selectIcon}
		onClose={() => showIconPicker = false}
	/>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
	<Modal open={true} onClose={() => showDeleteModal = false} title="Delete Format" size="sm">
		<div class="p-6 space-y-4">
			<div class="flex items-center gap-3 p-4 rounded-lg" style="background-color: #fef3c7; border: 1px solid #fcd34d;">
				<AlertCircle class="w-5 h-5 flex-shrink-0" style="color: #d97706;" />
				<div>
					<p class="font-medium" style="color: #92400e;">This format has {format.bookCount} book{format.bookCount === 1 ? '' : 's'}</p>
					<p class="text-sm mt-1" style="color: #a16207;">Choose what to do with the books before deleting.</p>
				</div>
			</div>

			<div>
				<label for="reassignTo" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
					Reassign books to:
				</label>
				<select
					id="reassignTo"
					bind:value={reassignToId}
					class="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-offset-0"
					style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); --tw-ring-color: var(--accent);"
				>
					<option value="null">No format (remove format from books)</option>
					{#each data.allFormats as fmt}
						<option value={fmt.id.toString()}>{fmt.name}</option>
					{/each}
				</select>
			</div>

			<div class="flex items-center gap-2 text-sm" style="color: var(--text-secondary);">
				<span class="font-medium">{format.name}</span>
				<ArrowRight class="w-4 h-4" />
				<span class="font-medium">{reassignTargetName}</span>
			</div>

			<div class="flex justify-end gap-3 pt-4" style="border-top: 1px solid var(--border-color);">
				<button
					type="button"
					class="px-4 py-2 rounded-lg transition-colors"
					style="color: var(--text-secondary);"
					onclick={() => showDeleteModal = false}
					disabled={deleting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
					style="background-color: #ef4444; color: white;"
					onclick={confirmDelete}
					disabled={deleting}
				>
					{#if deleting}
						<Loader2 class="w-4 h-4 animate-spin" />
					{:else}
						<Trash2 class="w-4 h-4" />
					{/if}
					Delete Format
				</button>
			</div>
		</div>
	</Modal>
{/if}

<style>
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}
</style>
