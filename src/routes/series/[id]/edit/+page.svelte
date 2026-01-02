<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import { ArrowLeft, Loader2, Library, Hash, BookOpen, Tag } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';

	let { data } = $props();
	const series = data.series;

	// Get return URL from query params
	let returnTo = $derived($page.url.searchParams.get('returnTo') || `/series/${series.id}`);

	let saving = $state(false);

	// Form fields
	let title = $state(series.title || '');
	let description = $state(series.description || '');
	let numBooks = $state(series.numBooks?.toString() || '');
	let comments = $state(series.comments || '');
	let statusId = $state(series.statusId?.toString() || '');
	let genreId = $state(series.genreId?.toString() || '');

	// Tags
	let selectedTagIds = $state<number[]>(data.tags.map((t: { id: number }) => t.id));

	function toggleTag(tagId: number) {
		if (selectedTagIds.includes(tagId)) {
			selectedTagIds = selectedTagIds.filter((id) => id !== tagId);
		} else {
			selectedTagIds = [...selectedTagIds, tagId];
		}
	}

	async function handleSave() {
		if (!title.trim()) return;
		saving = true;
		try {
			const res = await fetch(`/api/series/${series.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim() || null,
					numBooks: numBooks ? parseInt(numBooks) : null,
					comments: comments.trim() || null,
					statusId: statusId ? parseInt(statusId) : null,
					genreId: genreId ? parseInt(genreId) : null
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save series');
				return;
			}

			// Update tags separately
			await updateTags();

			toasts.success('Series saved');
			await tick();
			goto(decodeURIComponent(returnTo));
		} finally {
			saving = false;
		}
	}

	async function updateTags() {
		const currentTagIds = data.tags.map((t: { id: number }) => t.id);

		// Add new tags
		for (const tagId of selectedTagIds) {
			if (!currentTagIds.includes(tagId)) {
				await fetch(`/api/series/${series.id}/tags`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ tagId })
				});
			}
		}

		// Remove unselected tags
		for (const tagId of currentTagIds) {
			if (!selectedTagIds.includes(tagId)) {
				await fetch(`/api/series/${series.id}/tags`, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ tagId })
				});
			}
		}
	}
</script>

<svelte:head>
	<title>Edit {series.title} - BookShelf</title>
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
					onclick={() => goto(decodeURIComponent(returnTo))}
				>
					<ArrowLeft class="w-4 h-4" />
					<span class="hidden sm:inline">Back</span>
				</button>

				<h1 class="font-semibold truncate max-w-[200px] sm:max-w-md" style="color: var(--text-primary);">
					Edit Series
				</h1>

				<div class="flex items-center gap-2">
					<button
						type="button"
						class="px-3 py-1.5 text-sm rounded-lg transition-colors"
						style="color: var(--text-muted);"
						onclick={() => goto(decodeURIComponent(returnTo))}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn-accent px-4 py-1.5 text-sm flex items-center gap-2"
						disabled={saving || !title.trim()}
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
			<!-- Sidebar with Stats -->
			<div class="hidden lg:block w-48 flex-shrink-0">
				<div class="sticky top-20 space-y-4">
					<!-- Series Stats Card -->
					<div
						class="rounded-lg p-4"
						style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
					>
						<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Series Stats</h3>
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--text-muted);">Books</span>
								<span class="text-sm font-medium" style="color: var(--text-primary);"
									>{data.stats.totalBooks}</span
								>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--text-muted);">Read</span>
								<span class="text-sm font-medium" style="color: var(--text-primary);"
									>{data.stats.readBooks}</span
								>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--text-muted);">Avg Rating</span>
								<span class="text-sm font-medium" style="color: var(--text-primary);">
									{data.stats.averageRating ? data.stats.averageRating.toFixed(1) : '-'}
								</span>
							</div>
						</div>
					</div>

					<!-- Quick View -->
					<a
						href="/series/{series.id}"
						class="w-full btn-ghost flex items-center justify-center gap-2 py-2 text-sm rounded-lg"
					>
						<Library class="w-4 h-4" />
						View Series
					</a>
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
						<!-- Title -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label for="title" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
								Title <span style="color: var(--accent);">*</span>
							</label>
							<input
								id="title"
								type="text"
								bind:value={title}
								required
								class="w-full px-3 py-2 rounded-md transition-all focus:ring-2 focus:ring-offset-0"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); --tw-ring-color: var(--accent);"
								placeholder="Series title"
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
								rows="4"
								class="w-full px-3 py-2 rounded-md text-sm resize-y"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
								placeholder="Series description..."
							></textarea>
						</div>

						<!-- Notes -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label for="comments" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
								Personal Notes
							</label>
							<textarea
								id="comments"
								bind:value={comments}
								rows="3"
								class="w-full px-3 py-2 rounded-md text-sm resize-y"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
								placeholder="Your personal notes..."
							></textarea>
						</div>

						<!-- Classification -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Classification</h3>
							<div class="grid grid-cols-3 gap-4">
								<div>
									<label for="numBooks" class="block text-xs mb-1" style="color: var(--text-muted);"
										>Total Books</label
									>
									<input
										id="numBooks"
										type="number"
										min="0"
										bind:value={numBooks}
										class="w-full px-2 py-1.5 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										placeholder="e.g. 12"
									/>
								</div>
								<div>
									<label for="statusId" class="block text-xs mb-1" style="color: var(--text-muted);">Status</label
									>
									<select
										id="statusId"
										bind:value={statusId}
										class="w-full px-2 py-1.5 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
									>
										<option value="">-</option>
										{#each data.allStatuses as status}
											<option value={status.id.toString()}>{status.name}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="genreId" class="block text-xs mb-1" style="color: var(--text-muted);">Genre</label>
									<select
										id="genreId"
										bind:value={genreId}
										class="w-full px-2 py-1.5 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
									>
										<option value="">-</option>
										{#each data.allGenres as genre}
											<option value={genre.id.toString()}>{genre.name}</option>
										{/each}
									</select>
								</div>
							</div>
						</div>

						<!-- Tags -->
						{#if data.allTags.length > 0}
							<div
								class="rounded-lg p-4"
								style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
							>
								<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
									<Tag class="w-3.5 h-3.5" />
									Tags
								</h3>
								<div class="flex flex-wrap gap-2">
									{#each data.allTags as tag}
										<button
											type="button"
											class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
											style="background-color: {selectedTagIds.includes(tag.id)
												? tag.color || 'var(--accent)'
												: 'var(--bg-tertiary)'}; color: {selectedTagIds.includes(tag.id)
												? 'white'
												: 'var(--text-secondary)'}; border: 1px solid {selectedTagIds.includes(tag.id)
												? 'transparent'
												: 'var(--border-color)'};"
											onclick={() => toggleTag(tag.id)}
										>
											{#if tag.icon}
												<DynamicIcon icon={tag.icon} size={14} />
											{/if}
											{tag.name}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Books in Series (Read-only reference) -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
								<BookOpen class="w-3.5 h-3.5" />
								Books in Series ({data.books.length})
							</h3>
							{#if data.books.length > 0}
								<div class="space-y-1.5 max-h-48 overflow-y-auto">
									{#each data.books as book}
										<div
											class="flex items-center gap-2 p-2 rounded"
											style="background-color: var(--bg-tertiary);"
										>
											{#if book.bookNum}
												<span
													class="text-xs font-medium px-1.5 py-0.5 rounded"
													style="background-color: var(--bg-secondary); color: var(--text-muted);"
												>
													#{book.bookNum}
												</span>
											{/if}
											<span class="text-sm truncate" style="color: var(--text-primary);">{book.title}</span>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-sm" style="color: var(--text-muted);">No books in this series yet.</p>
							{/if}
						</div>
					</div>
				</form>
			</div>
		</div>
	</div>
</div>
