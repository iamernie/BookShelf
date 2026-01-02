<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		ShoppingBag,
		Plus,
		Trash2,
		Edit,
		X,
		Check,
		ExternalLink,
		Lock,
		GripVertical
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';

	let { data } = $props();

	// Available icons for media sources
	const availableIcons = [
		'shopping-bag', 'headphones', 'tablet', 'book', 'book-open', 'smartphone',
		'library', 'play', 'music', 'disc', 'radio', 'tv', 'monitor', 'globe',
		'store', 'package', 'gift', 'credit-card', 'bookmark', 'folder'
	];

	// Predefined colors
	const presetColors = [
		'#f7971e', '#ff9900', '#8b4513', '#bf0811', '#000000', '#4285f4',
		'#2e7d32', '#f5a623', '#6c757d', '#e91e63', '#9c27b0', '#673ab7',
		'#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff5722'
	];

	// Modal state
	let showModal = $state(false);
	let editingSource = $state<any>(null);
	let saving = $state(false);

	// Form fields
	let name = $state('');
	let icon = $state('shopping-bag');
	let color = $state('#6c757d');
	let url = $state('');

	function openAddModal() {
		editingSource = null;
		name = '';
		icon = 'shopping-bag';
		color = '#6c757d';
		url = '';
		showModal = true;
	}

	function openEditModal(source: any) {
		editingSource = source;
		name = source.name;
		icon = source.icon || 'shopping-bag';
		color = source.color || '#6c757d';
		url = source.url || '';
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingSource = null;
	}

	async function handleSave() {
		if (!name.trim()) {
			toasts.error('Name is required');
			return;
		}

		saving = true;
		try {
			const payload = {
				name: name.trim(),
				icon,
				color,
				url: url.trim() || null
			};

			if (editingSource) {
				// Update existing
				const res = await fetch(`/api/media-sources/${editingSource.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (res.ok) {
					toasts.success('Media source updated');
					closeModal();
					invalidateAll();
				} else {
					const err = await res.json();
					toasts.error(err.message || 'Failed to update');
				}
			} else {
				// Create new
				const res = await fetch('/api/media-sources', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (res.ok) {
					toasts.success('Media source created');
					closeModal();
					invalidateAll();
				} else {
					const err = await res.json();
					toasts.error(err.message || 'Failed to create');
				}
			}
		} finally {
			saving = false;
		}
	}

	async function handleDelete(source: any) {
		if (source.isSystem) {
			toasts.error('Cannot delete system media sources');
			return;
		}

		if (!confirm(`Delete "${source.name}"? This will remove it from all books.`)) {
			return;
		}

		try {
			const res = await fetch(`/api/media-sources/${source.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				toasts.success('Media source deleted');
				invalidateAll();
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to delete');
			}
		} catch {
			toasts.error('Failed to delete');
		}
	}
</script>

<svelte:head>
	<title>Media Sources - BookShelf Admin</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: var(--bg-tertiary);">
				<ShoppingBag class="w-5 h-5" style="color: var(--accent);" />
			</div>
			<div>
				<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Media Sources</h1>
				<p class="text-sm" style="color: var(--text-muted);">Manage where books can be purchased or owned</p>
			</div>
		</div>

		<button
			onclick={openAddModal}
			class="btn-accent flex items-center gap-2 px-4 py-2"
		>
			<Plus class="w-4 h-4" />
			Add Source
		</button>
	</div>

	<!-- Sources List -->
	<div class="rounded-xl overflow-hidden" style="background: var(--bg-secondary); border: 1px solid var(--border-color);">
		{#if data.mediaSources.length === 0}
			<div class="p-8 text-center" style="color: var(--text-muted);">
				No media sources found
			</div>
		{:else}
			<div class="divide-y" style="border-color: var(--border-color);">
				{#each data.mediaSources as source}
					<div class="flex items-center gap-4 p-4 hover:bg-opacity-50 transition-colors" style="background: var(--bg-secondary);">
						<!-- Icon with color -->
						<div
							class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
							style="background-color: {source.color || '#6c757d'}20;"
						>
							<LucideIcon name={source.icon || 'shopping-bag'} size={20} color={source.color || '#6c757d'} />
						</div>

						<!-- Info -->
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium" style="color: var(--text-primary);">{source.name}</span>
								{#if source.isSystem}
									<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style="background: var(--bg-tertiary); color: var(--text-muted);">
										<Lock class="w-3 h-3" />
										System
									</span>
								{/if}
							</div>
							{#if source.url}
								<a
									href={source.url}
									target="_blank"
									rel="noopener noreferrer"
									class="text-xs flex items-center gap-1 hover:underline"
									style="color: var(--accent);"
								>
									{source.url}
									<ExternalLink class="w-3 h-3" />
								</a>
							{:else}
								<span class="text-xs" style="color: var(--text-muted);">No URL</span>
							{/if}
						</div>

						<!-- Color preview -->
						<div
							class="w-6 h-6 rounded-full flex-shrink-0"
							style="background-color: {source.color || '#6c757d'};"
							title={source.color}
						></div>

						<!-- Actions -->
						<div class="flex items-center gap-2">
							<button
								onclick={() => openEditModal(source)}
								class="p-2 rounded-lg transition-colors hover:bg-opacity-80"
								style="background: var(--bg-tertiary); color: var(--text-secondary);"
								title="Edit"
							>
								<Edit class="w-4 h-4" />
							</button>
							{#if !source.isSystem}
								<button
									onclick={() => handleDelete(source)}
									class="p-2 rounded-lg transition-colors"
									style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"
									title="Delete"
								>
									<Trash2 class="w-4 h-4" />
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Add/Edit Modal -->
{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(0, 0, 0, 0.6);"
	>
		<div
			class="w-full max-w-md rounded-xl shadow-xl"
			style="background: var(--bg-secondary);"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b" style="border-color: var(--border-color);">
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					{editingSource ? 'Edit Media Source' : 'Add Media Source'}
				</h2>
				<button
					onclick={closeModal}
					class="p-1 rounded-lg transition-colors hover:bg-opacity-80"
					style="background: var(--bg-tertiary); color: var(--text-muted);"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Form -->
			<div class="p-4 space-y-4">
				<!-- Name -->
				<div>
					<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
						Name <span style="color: #ef4444;">*</span>
					</label>
					<input
						type="text"
						bind:value={name}
						placeholder="e.g., Storytel, Scribd..."
						class="w-full px-3 py-2 rounded-lg text-sm"
						style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
					/>
				</div>

				<!-- Icon -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Icon
					</label>
					<div class="flex flex-wrap gap-2">
						{#each availableIcons as iconName}
							<button
								type="button"
								onclick={() => icon = iconName}
								class="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
								style="background: {icon === iconName ? color : 'var(--bg-tertiary)'}; color: {icon === iconName ? 'white' : 'var(--text-secondary)'}; border: 2px solid {icon === iconName ? color : 'transparent'};"
							>
								<LucideIcon name={iconName} size={18} />
							</button>
						{/each}
					</div>
				</div>

				<!-- Color -->
				<div>
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Color
					</label>
					<div class="flex flex-wrap gap-2 mb-2">
						{#each presetColors as presetColor}
							<button
								type="button"
								onclick={() => color = presetColor}
								class="w-8 h-8 rounded-full transition-all"
								style="background-color: {presetColor}; border: 3px solid {color === presetColor ? 'white' : 'transparent'}; box-shadow: {color === presetColor ? '0 0 0 2px ' + presetColor : 'none'};"
							></button>
						{/each}
					</div>
					<div class="flex items-center gap-2">
						<input
							type="color"
							bind:value={color}
							class="w-10 h-10 rounded cursor-pointer"
						/>
						<input
							type="text"
							bind:value={color}
							placeholder="#6c757d"
							class="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
							style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
						/>
					</div>
				</div>

				<!-- URL -->
				<div>
					<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">
						Website URL <span style="color: var(--text-muted);">(optional)</span>
					</label>
					<input
						type="url"
						bind:value={url}
						placeholder="https://..."
						class="w-full px-3 py-2 rounded-lg text-sm"
						style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
					/>
				</div>

				<!-- Preview -->
				<div class="pt-2">
					<label class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
						Preview
					</label>
					<div class="flex items-center gap-3 p-3 rounded-lg" style="background: var(--bg-tertiary);">
						<span
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white"
							style="background-color: {color};"
						>
							<LucideIcon name={icon} size={14} />
							{name || 'Source Name'}
						</span>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-2 p-4 border-t" style="border-color: var(--border-color);">
				<button
					onclick={closeModal}
					class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
					style="background: var(--bg-tertiary); color: var(--text-secondary);"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={saving || !name.trim()}
					class="btn-accent px-4 py-2 flex items-center gap-2"
				>
					{#if saving}
						<span class="animate-spin">⏳</span>
					{:else}
						<Check class="w-4 h-4" />
					{/if}
					{editingSource ? 'Save Changes' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}
