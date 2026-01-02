<script lang="ts">
	import { X, Plus, Check, Search } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import { toasts } from '$lib/stores/toast';

	interface TagItem {
		id: number;
		name: string;
		color: string | null;
		icon: string | null;
	}

	let {
		entityType,
		entityId,
		currentTags = [],
		allTags = [],
		onUpdate
	}: {
		entityType: 'book' | 'series' | 'author';
		entityId: number;
		currentTags: TagItem[];
		allTags: TagItem[];
		onUpdate?: (tags: TagItem[]) => void;
	} = $props();

	let showDropdown = $state(false);
	let searchQuery = $state('');
	let togglingTagId = $state<number | null>(null);
	let appliedTags = $state<TagItem[]>(currentTags);

	// Get IDs of applied tags
	let appliedTagIds = $derived(new Set(appliedTags.map((t) => t.id)));

	// Filter available tags (not already applied) by search query
	let availableTags = $derived(
		allTags.filter((t) => {
			const matchesSearch = !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase());
			const notApplied = !appliedTagIds.has(t.id);
			return matchesSearch && notApplied;
		})
	);

	async function addTag(tag: TagItem) {
		if (togglingTagId !== null) return;

		togglingTagId = tag.id;

		try {
			const body: Record<string, number> = { tagId: tag.id };
			if (entityType === 'book') body.bookId = entityId;
			else if (entityType === 'series') body.seriesId = entityId;
			else if (entityType === 'author') body.authorId = entityId;

			const res = await fetch('/api/tags/toggle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				appliedTags = [...appliedTags, tag];
				onUpdate?.(appliedTags);
				searchQuery = '';
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to add tag');
			}
		} catch (e) {
			toasts.error('Failed to add tag');
		} finally {
			togglingTagId = null;
		}
	}

	async function removeTag(tag: TagItem) {
		if (togglingTagId !== null) return;

		togglingTagId = tag.id;

		try {
			const body: Record<string, number> = { tagId: tag.id };
			if (entityType === 'book') body.bookId = entityId;
			else if (entityType === 'series') body.seriesId = entityId;
			else if (entityType === 'author') body.authorId = entityId;

			const res = await fetch('/api/tags/toggle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				appliedTags = appliedTags.filter((t) => t.id !== tag.id);
				onUpdate?.(appliedTags);
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to remove tag');
			}
		} catch (e) {
			toasts.error('Failed to remove tag');
		} finally {
			togglingTagId = null;
		}
	}

	function closeDropdown() {
		showDropdown = false;
		searchQuery = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showDropdown) {
			closeDropdown();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="inline-tag-editor">
	<!-- Applied Tags -->
	<div class="applied-tags">
		{#each appliedTags as tag (tag.id)}
			{@const isRemoving = togglingTagId === tag.id}
			<a
				href="/{entityType === 'book' ? 'books' : entityType === 'author' ? 'authors' : 'series'}?tag={tag.id}"
				class="applied-tag"
				class:removing={isRemoving}
				style="--tag-color: {tag.color || '#6c757d'};"
			>
				{#if tag.icon}
					<DynamicIcon icon={tag.icon} size={12} color={tag.color || '#6c757d'} />
				{:else}
					<span class="tag-dot" style="background-color: {tag.color || '#6c757d'};"></span>
				{/if}
				<span class="tag-name">{tag.name}</span>
				<button
					type="button"
					class="remove-btn"
					onclick={(e) => { e.preventDefault(); e.stopPropagation(); removeTag(tag); }}
					disabled={isRemoving}
					aria-label="Remove {tag.name}"
				>
					<X class="w-3 h-3" />
				</button>
			</a>
		{/each}

		<!-- Add Tag Button -->
		<div class="add-tag-wrapper">
			<button
				type="button"
				class="add-tag-btn"
				onclick={() => showDropdown = !showDropdown}
			>
				<Plus class="w-3.5 h-3.5" />
				<span>Add Tag</span>
			</button>

			<!-- Dropdown -->
			{#if showDropdown}
				<button
					type="button"
					class="dropdown-backdrop"
					onclick={closeDropdown}
					aria-label="Close dropdown"
				></button>
				<div class="dropdown">
					<!-- Search -->
					{#if allTags.length > 6}
						<div class="dropdown-search">
							<Search class="w-4 h-4 search-icon" />
							<input
								type="text"
								placeholder="Search tags..."
								bind:value={searchQuery}
								class="search-input"
							/>
						</div>
					{/if}

					<!-- Available Tags -->
					<div class="dropdown-list">
						{#if availableTags.length === 0}
							<p class="empty-message">
								{#if searchQuery}
									No tags match "{searchQuery}"
								{:else if appliedTags.length === allTags.length}
									All tags applied
								{:else}
									No tags available
								{/if}
							</p>
						{:else}
							{#each availableTags as tag (tag.id)}
								{@const isAdding = togglingTagId === tag.id}
								<button
									type="button"
									class="dropdown-item"
									class:adding={isAdding}
									onclick={() => addTag(tag)}
									disabled={isAdding}
								>
									{#if tag.icon}
										<DynamicIcon icon={tag.icon} size={14} color={tag.color || '#6c757d'} />
									{:else}
										<div
											class="tag-dot"
											style="background-color: {tag.color || '#6c757d'};"
										></div>
									{/if}
									<span class="dropdown-tag-name">{tag.name}</span>
								</button>
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#if appliedTags.length === 0 && !showDropdown}
		<p class="no-tags-hint">No tags assigned</p>
	{/if}
</div>

<style>
	.inline-tag-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.applied-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.applied-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		padding-right: 0.25rem;
		border-radius: 0.375rem;
		font-size: 0.8rem;
		font-weight: 500;
		text-decoration: none;
		color: var(--tag-color);
		background-color: color-mix(in srgb, var(--tag-color) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--tag-color) 30%, transparent);
		transition: all 0.15s;
	}

	.applied-tag:hover {
		background-color: color-mix(in srgb, var(--tag-color) 25%, transparent);
	}

	.applied-tag.removing {
		opacity: 0.5;
	}

	.tag-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.tag-name {
		white-space: nowrap;
	}

	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem;
		margin-left: 0.125rem;
		border-radius: 0.25rem;
		color: inherit;
		opacity: 0.6;
		transition: all 0.15s;
	}

	.remove-btn:hover {
		opacity: 1;
		background-color: color-mix(in srgb, var(--tag-color) 30%, transparent);
	}

	.add-tag-wrapper {
		position: relative;
	}

	.add-tag-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.625rem;
		border-radius: 0.375rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
		background-color: var(--bg-tertiary);
		border: 1px dashed var(--border-color);
		transition: all 0.15s;
	}

	.add-tag-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
		background-color: var(--accent-muted);
	}

	.dropdown-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 0.25rem);
		left: 0;
		z-index: 50;
		width: 200px;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}

	.dropdown-search {
		position: relative;
		padding: 0.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.375rem 0.5rem 0.375rem 1.75rem;
		font-size: 0.8rem;
		background-color: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 0.375rem;
		color: var(--text-primary);
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.dropdown-list {
		max-height: 200px;
		overflow-y: auto;
		padding: 0.25rem;
	}

	.empty-message {
		padding: 0.75rem;
		text-align: center;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.625rem;
		border-radius: 0.375rem;
		text-align: left;
		transition: background-color 0.15s;
	}

	.dropdown-item:hover {
		background-color: var(--bg-tertiary);
	}

	.dropdown-item.adding {
		opacity: 0.5;
	}

	.dropdown-tag-name {
		font-size: 0.8rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.no-tags-hint {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-style: italic;
	}
</style>
