<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import {
		ArrowLeft,
		Loader2,
		Tag,
		BookOpen,
		Library,
		Palette
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import IconPicker from '$lib/components/ui/IconPicker.svelte';

	let { data } = $props();
	const tag = data.tag;

	// Get return URL from query params
	let returnTo = $derived($page.url.searchParams.get('returnTo') || `/tags`);

	let saving = $state(false);

	// Form fields
	let name = $state(tag.name || '');
	let color = $state(tag.color || '#6b7280');
	let icon = $state(tag.icon || '');

	// Icon picker state
	let showIconPicker = $state(false);

	async function handleSave() {
		if (!name.trim()) return;

		// System tags can't be renamed
		if (tag.isSystem) {
			toasts.error('System tags cannot be modified');
			return;
		}

		saving = true;
		try {
			const res = await fetch(`/api/tags/${tag.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					color: color || null,
					icon: icon || null
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save tag');
				return;
			}

			toasts.success('Tag saved');
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
	<title>Edit {tag.name} - BookShelf</title>
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
					Edit Tag
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
						disabled={saving || !name.trim() || tag.isSystem}
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
		{#if tag.isSystem}
			<div class="mb-4 p-3 rounded-lg" style="background-color: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3);">
				<p class="text-sm" style="color: #ca8a04;">
					This is a system tag and cannot be modified.
				</p>
			</div>
		{/if}

		<div class="flex gap-6">
			<!-- Sidebar with Preview and Stats -->
			<div class="hidden lg:block w-48 flex-shrink-0">
				<div class="sticky top-20 space-y-4">
					<!-- Tag Preview -->
					<div
						class="rounded-lg p-4"
						style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
					>
						<div class="flex items-center justify-center gap-2 py-4">
							<span
								class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
								style="background-color: {color}20; color: {color};"
							>
								{#if icon}
									<DynamicIcon {icon} size={16} {color} />
								{:else}
									<Tag class="w-4 h-4" />
								{/if}
								{name || 'Tag Name'}
							</span>
						</div>
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
									{tag.bookCount}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--text-muted);">Series</span>
								<span class="text-sm font-medium" style="color: var(--text-primary);">
									{tag.seriesCount}
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
								disabled={tag.isSystem}
								class="w-full px-3 py-2 rounded-md transition-all focus:ring-2 focus:ring-offset-0"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); --tw-ring-color: var(--accent);"
								placeholder="Tag name"
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
								{#each data.colors as colorOpt}
									<button
										type="button"
										class="w-8 h-8 rounded-lg transition-transform hover:scale-110"
										class:ring-2={color === colorOpt.value}
										class:ring-offset-2={color === colorOpt.value}
										style="background-color: {colorOpt.value}; --tw-ring-color: var(--accent);"
										title={colorOpt.name}
										onclick={() => color = colorOpt.value}
										disabled={tag.isSystem}
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
									disabled={tag.isSystem}
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
										<Tag class="w-6 h-6" style="color: var(--text-muted);" />
									{/if}
								</div>
								<button
									type="button"
									class="px-3 py-1.5 text-sm rounded-lg transition-colors"
									style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
									onclick={() => showIconPicker = true}
									disabled={tag.isSystem}
								>
									Choose Icon
								</button>
								{#if icon}
									<button
										type="button"
										class="px-3 py-1.5 text-sm rounded-lg transition-colors"
										style="color: var(--text-muted);"
										onclick={() => icon = ''}
										disabled={tag.isSystem}
									>
										Clear
									</button>
								{/if}
							</div>
						</div>

						<!-- Books with Tag -->
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

						<!-- Series with Tag -->
						{#if data.series.length > 0}
							<div
								class="rounded-lg p-4"
								style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
							>
								<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
									<Library class="w-3.5 h-3.5" />
									Series ({data.series.length})
								</h3>
								<div class="space-y-1.5 max-h-32 overflow-y-auto">
									{#each data.series as seriesItem}
										<a
											href="/series/{seriesItem.id}"
											class="flex items-center justify-between p-2 rounded transition-colors hover:opacity-80"
											style="background-color: var(--bg-tertiary);"
										>
											<span class="text-sm" style="color: var(--text-primary);">{seriesItem.title}</span>
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
