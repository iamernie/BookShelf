<script lang="ts">
	import { X, Library, Eye, BookOpen } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import ShelfRuleBuilder from './ShelfRuleBuilder.svelte';
	import type { FilterConfig, FilterGroup } from '$lib/server/services/magicShelfService';

	interface OptionItem {
		id: number;
		name: string;
	}

	interface ShelfData {
		id?: number;
		name: string;
		description: string;
		icon: string;
		iconColor: string;
		filterJson: FilterConfig;
		sortField: string;
		sortOrder: string;
		isPublic: boolean;
	}

	let {
		shelf = null,
		statuses = [],
		genres = [],
		formats = [],
		authors = [],
		series = [],
		tags = [],
		narrators = [],
		onClose,
		onSave
	}: {
		shelf?: ShelfData | null;
		statuses: OptionItem[];
		genres: OptionItem[];
		formats: OptionItem[];
		authors: OptionItem[];
		series: OptionItem[];
		tags: OptionItem[];
		narrators: OptionItem[];
		onClose: () => void;
		onSave: () => void;
	} = $props();

	let name = $state(shelf?.name || '');
	let description = $state(shelf?.description || '');
	let iconColor = $state(shelf?.iconColor || '#6c757d');
	let sortField = $state(shelf?.sortField || 'title');
	let sortOrder = $state(shelf?.sortOrder || 'asc');
	let isPublic = $state(shelf?.isPublic || false);
	let filterConfig = $state<FilterConfig>(
		shelf?.filterJson || { logic: 'AND', rules: [{ field: 'statusId', operator: 'equals', value: null }] }
	);

	let loading = $state(false);
	let previewCount = $state<number | null>(null);
	let previewLoading = $state(false);

	const SORT_FIELDS = [
		{ value: 'title', label: 'Title' },
		{ value: 'rating', label: 'Rating' },
		{ value: 'completedDate', label: 'Date Completed' },
		{ value: 'createdAt', label: 'Date Added' },
		{ value: 'pageCount', label: 'Page Count' },
		{ value: 'publishYear', label: 'Publish Year' }
	];

	const ICON_COLORS = [
		'#6c757d', '#dc3545', '#fd7e14', '#ffc107',
		'#28a745', '#20c997', '#17a2b8', '#007bff',
		'#6f42c1', '#e83e8c'
	];

	async function handleSubmit() {
		if (!name.trim()) {
			toasts.warning('Please enter a name for the shelf');
			return;
		}

		loading = true;
		try {
			const url = shelf?.id ? `/api/shelves/${shelf.id}` : '/api/shelves';
			const method = shelf?.id ? 'PUT' : 'POST';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
					iconColor,
					filterJson: filterConfig,
					sortField,
					sortOrder,
					isPublic
				})
			});

			if (res.ok) {
				toasts.success(`Shelf ${shelf?.id ? 'updated' : 'created'} successfully`);
				onSave();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save shelf');
			}
		} catch (e) {
			toasts.error('Failed to save shelf');
		} finally {
			loading = false;
		}
	}

	async function loadPreview() {
		previewLoading = true;
		try {
			const res = await fetch('/api/shelves/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filterJson: filterConfig, limit: 1 })
			});

			if (res.ok) {
				const result = await res.json();
				previewCount = result.total;
			}
		} catch (e) {
			console.error('Preview failed:', e);
		} finally {
			previewLoading = false;
		}
	}

	// Load preview when filter changes
	$effect(() => {
		filterConfig;
		loadPreview();
	});
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
		class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border"
		style="background-color: var(--bg-secondary); border-color: var(--border-color);"
	>
		<!-- Header -->
		<div class="sticky top-0 flex items-center justify-between p-4 border-b z-10" style="border-color: var(--border-color); background-color: var(--bg-secondary);">
			<div class="flex items-center gap-2">
				<Library class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					{shelf?.id ? 'Edit' : 'Create'} Magic Shelf
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

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<div class="p-4 space-y-6">
				<!-- Basic Info -->
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
							Name
						</label>
						<input
							type="text"
							class="input-field w-full"
							placeholder="My Shelf"
							bind:value={name}
						/>
					</div>

					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
							Description
						</label>
						<textarea
							class="input-field w-full"
							rows="2"
							placeholder="Optional description..."
							bind:value={description}
						></textarea>
					</div>

					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
							Color
						</label>
						<div class="flex gap-2">
							{#each ICON_COLORS as color}
								<button
									type="button"
									class="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
									style="background-color: {color}; border-color: {iconColor === color ? 'white' : 'transparent'};"
									onclick={() => iconColor = color}
								></button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Filter Rules -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<label class="text-sm font-medium" style="color: var(--text-secondary);">
							Filter Rules
						</label>
						<div class="flex items-center gap-2 text-sm" style="color: var(--text-muted);">
							<BookOpen class="w-4 h-4" />
							{#if previewLoading}
								<span>Loading...</span>
							{:else if previewCount !== null}
								<span>{previewCount} book{previewCount !== 1 ? 's' : ''} match</span>
							{/if}
						</div>
					</div>
					<ShelfRuleBuilder
						bind:filterConfig
						{statuses}
						{genres}
						{formats}
						{authors}
						{series}
						{tags}
						{narrators}
					/>
				</div>

				<!-- Sort Options -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
							Sort By
						</label>
						<select class="input-field w-full" bind:value={sortField}>
							{#each SORT_FIELDS as field}
								<option value={field.value}>{field.label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
							Order
						</label>
						<select class="input-field w-full" bind:value={sortOrder}>
							<option value="asc">Ascending</option>
							<option value="desc">Descending</option>
						</select>
					</div>
				</div>

				<!-- Public Toggle -->
				<label class="flex items-center gap-3 cursor-pointer">
					<input
						type="checkbox"
						class="w-4 h-4 rounded"
						bind:checked={isPublic}
					/>
					<div>
						<span class="font-medium" style="color: var(--text-primary);">Public Shelf</span>
						<p class="text-sm" style="color: var(--text-muted);">
							Allow other users to view this shelf
						</p>
					</div>
				</label>
			</div>

			<!-- Footer -->
			<div class="sticky bottom-0 flex justify-end gap-3 p-4 border-t" style="border-color: var(--border-color); background-color: var(--bg-secondary);">
				<button
					type="button"
					class="btn-ghost px-4 py-2"
					onclick={onClose}
					disabled={loading}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="btn-accent px-4 py-2"
					disabled={loading}
				>
					{#if loading}
						Saving...
					{:else}
						{shelf?.id ? 'Update' : 'Create'} Shelf
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.input-field {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
		color: var(--text-primary);
	}

	.input-field:focus {
		outline: none;
		border-color: var(--accent);
	}
</style>
