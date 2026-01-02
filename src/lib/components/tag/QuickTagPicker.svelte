<script lang="ts">
	import { Tag, Check, Search, X } from 'lucide-svelte';
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
		currentTagIds,
		allTags,
		position = { x: 0, y: 0 },
		onClose,
		onUpdate
	}: {
		entityType: 'book' | 'series' | 'author';
		entityId: number;
		currentTagIds: number[];
		allTags: TagItem[];
		position?: { x: number; y: number };
		onClose: () => void;
		onUpdate: (tagIds: number[]) => void;
	} = $props();

	let searchQuery = $state('');
	let togglingTagId = $state<number | null>(null);
	let appliedTagIds = $state<Set<number>>(new Set(currentTagIds));

	// Filter tags by search query
	let filteredTags = $derived(
		searchQuery.trim()
			? allTags.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: allTags
	);

	async function toggleTag(tag: TagItem) {
		if (togglingTagId !== null) return;

		togglingTagId = tag.id;
		const wasApplied = appliedTagIds.has(tag.id);

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
				const newSet = new Set(appliedTagIds);
				if (wasApplied) {
					newSet.delete(tag.id);
				} else {
					newSet.add(tag.id);
				}
				appliedTagIds = newSet;
				onUpdate(Array.from(newSet));
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to toggle tag');
			}
		} catch (e) {
			toasts.error('Failed to toggle tag');
		} finally {
			togglingTagId = null;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	// Position the dropdown
	let dropdownStyle = $derived(() => {
		// Default positioning - can be adjusted based on viewport
		return `left: ${position.x}px; top: ${position.y}px;`;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 z-40"
	onclick={onClose}
	aria-label="Close tag picker"
></button>

<!-- Dropdown -->
<div
	class="quick-tag-picker"
	style={dropdownStyle()}
	role="dialog"
	aria-label="Quick tag picker"
>
	<!-- Header -->
	<div class="picker-header">
		<Tag class="w-4 h-4" style="color: var(--accent);" />
		<span>Tags</span>
		<button
			type="button"
			class="close-btn"
			onclick={onClose}
			aria-label="Close"
		>
			<X class="w-4 h-4" />
		</button>
	</div>

	<!-- Search -->
	{#if allTags.length > 6}
		<div class="search-container">
			<Search class="w-4 h-4 search-icon" />
			<input
				type="text"
				placeholder="Search tags..."
				bind:value={searchQuery}
				class="search-input"
			/>
		</div>
	{/if}

	<!-- Tag List -->
	<div class="tag-list">
		{#if filteredTags.length === 0}
			<p class="empty-message">
				{searchQuery ? 'No tags match your search' : 'No tags available'}
			</p>
		{:else}
			{#each filteredTags as tag (tag.id)}
				{@const isApplied = appliedTagIds.has(tag.id)}
				{@const isToggling = togglingTagId === tag.id}
				<button
					type="button"
					class="tag-item"
					class:applied={isApplied}
					class:toggling={isToggling}
					onclick={() => toggleTag(tag)}
					disabled={isToggling}
				>
					<div class="tag-content">
						{#if tag.icon}
							<DynamicIcon icon={tag.icon} size={14} color={tag.color || '#6c757d'} />
						{:else}
							<div
								class="tag-dot"
								style="background-color: {tag.color || '#6c757d'};"
							></div>
						{/if}
						<span class="tag-name" style="color: {isApplied ? tag.color || 'var(--text-primary)' : 'var(--text-secondary)'};">
							{tag.name}
						</span>
					</div>
					{#if isApplied}
						<Check class="w-4 h-4 check-icon" style="color: {tag.color || 'var(--accent)'};" />
					{/if}
				</button>
			{/each}
		{/if}
	</div>
</div>

<style>
	.quick-tag-picker {
		position: fixed;
		z-index: 50;
		width: 220px;
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}

	.picker-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid var(--border-color);
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.close-btn {
		margin-left: auto;
		padding: 0.25rem;
		border-radius: 0.25rem;
		color: var(--text-muted);
		transition: all 0.15s;
	}

	.close-btn:hover {
		background-color: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.search-container {
		position: relative;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--border-color);
	}

	.search-icon {
		position: absolute;
		left: 1rem;
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

	.tag-list {
		max-height: 240px;
		overflow-y: auto;
		padding: 0.375rem;
	}

	.empty-message {
		padding: 1rem;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.tag-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.5rem 0.625rem;
		border-radius: 0.375rem;
		text-align: left;
		transition: background-color 0.15s;
	}

	.tag-item:hover {
		background-color: var(--bg-tertiary);
	}

	.tag-item.applied {
		background-color: var(--bg-tertiary);
	}

	.tag-item.toggling {
		opacity: 0.6;
	}

	.tag-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.tag-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.tag-name {
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.check-icon {
		flex-shrink: 0;
	}
</style>
