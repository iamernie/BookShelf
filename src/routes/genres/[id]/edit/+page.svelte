<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import {
		ArrowLeft,
		Loader2,
		FolderOpen,
		BookOpen,
		Palette
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import IconPicker from '$lib/components/ui/IconPicker.svelte';

	let { data } = $props();
	const genre = data.genre;

	// Get return URL from query params
	let returnTo = $derived($page.url.searchParams.get('returnTo') || `/genres`);

	let saving = $state(false);

	// Form fields
	let name = $state(genre.name || '');
	let description = $state(genre.description || '');
	let color = $state(genre.color || '#6b7280');
	let icon = $state(genre.icon || '');
	let displayOrder = $state(genre.displayOrder ?? 0);

	// Icon picker state
	let showIconPicker = $state(false);

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
			const res = await fetch(`/api/genres/${genre.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
					color: color || null,
					icon: icon || null,
					displayOrder
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save genre');
				return;
			}

			toasts.success('Genre saved');
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
</script>

<svelte:head>
	<title>Edit {genre.name} - BookShelf</title>
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
					Edit Genre
				</h1>

				<div class="flex items-center gap-2">
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
			<!-- Sidebar with Icon Preview and Stats -->
			<div class="hidden lg:block w-48 flex-shrink-0">
				<div class="sticky top-20 space-y-4">
					<!-- Icon Preview -->
					<div
						class="rounded-lg p-4"
						style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
					>
						<div
							class="w-full aspect-square rounded-lg flex items-center justify-center mb-3"
							style="background-color: {color}20;"
						>
							{#if icon}
								<DynamicIcon {icon} size={48} {color} />
							{:else}
								<FolderOpen class="w-12 h-12" style="color: {color};" />
							{/if}
						</div>
						<p class="text-center text-sm font-medium" style="color: var(--text-primary);">
							{name || 'Genre Name'}
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
									{genre.bookCount}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--text-muted);">Avg Rating</span>
								<span class="text-sm font-medium" style="color: var(--text-primary);">
									{genre.avgRating ? genre.avgRating.toFixed(1) : '-'}
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
								placeholder="Genre name"
							/>
						</div>

						<!-- Description -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label for="description" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
								Description
							</label>
							<textarea
								id="description"
								bind:value={description}
								rows="3"
								class="w-full px-3 py-2 rounded-md text-sm resize-y"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
								placeholder="Genre description..."
							></textarea>
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
									{#if icon}
										<DynamicIcon {icon} size={24} {color} />
									{:else}
										<FolderOpen class="w-6 h-6" style="color: var(--text-muted);" />
									{/if}
								</div>
								<button
									type="button"
									class="px-3 py-1.5 text-sm rounded-lg transition-colors"
									style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
									onclick={() => showIconPicker = true}
								>
									Choose Icon
								</button>
								{#if icon}
									<button
										type="button"
										class="px-3 py-1.5 text-sm rounded-lg transition-colors"
										style="color: var(--text-muted);"
										onclick={() => icon = ''}
									>
										Clear
									</button>
								{/if}
							</div>
						</div>

						<!-- Display Order -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label for="displayOrder" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
								Display Order
							</label>
							<input
								id="displayOrder"
								type="number"
								bind:value={displayOrder}
								min="0"
								class="w-32 px-3 py-2 rounded-md text-sm"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
							/>
							<p class="text-xs mt-1" style="color: var(--text-muted);">
								Lower numbers appear first in lists
							</p>
						</div>

						<!-- Books in Genre (Read-only reference) -->
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
