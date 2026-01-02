<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { X, GripVertical, Sparkles } from 'lucide-svelte';
	import type { DashboardConfig, DashboardSection, DashboardSectionId } from '$lib/server/services/userPreferencesService';

	interface Props {
		open: boolean;
		config: DashboardConfig;
		magicShelves: { id: number; name: string; icon: string | null; iconColor: string | null }[];
		onClose: () => void;
		onSave: (config: DashboardConfig) => void;
	}

	let { open, config, magicShelves, onClose, onSave }: Props = $props();

	// Local state for editing
	let sections = $state<DashboardSection[]>([]);
	let draggedIndex = $state<number | null>(null);
	let dropTargetIndex = $state<number | null>(null);
	let saving = $state(false);

	// Section labels
	const sectionLabels: Record<DashboardSectionId, string> = {
		'reading-goal': 'Reading Goal',
		'continue-reading': 'Currently Reading',
		'smart-collection': 'Smart Collection',
		'up-next-series': 'Up Next in Series',
		'recently-added': 'Recently Added',
		'recently-completed': 'Recently Completed'
	};

	// Section icons
	const sectionIcons: Record<DashboardSectionId, string> = {
		'reading-goal': '🎯',
		'continue-reading': '📖',
		'smart-collection': '✨',
		'up-next-series': '📚',
		'recently-added': '🆕',
		'recently-completed': '✅'
	};

	// Initialize sections from config when modal opens
	$effect(() => {
		if (open && config) {
			sections = [...config.sections].sort((a, b) => a.order - b.order);
		}
	});

	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dropTargetIndex = index;
	}

	function handleDragLeave() {
		dropTargetIndex = null;
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === dropIndex) {
			draggedIndex = null;
			dropTargetIndex = null;
			return;
		}

		// Reorder sections
		const newSections = [...sections];
		const [draggedItem] = newSections.splice(draggedIndex, 1);
		newSections.splice(dropIndex, 0, draggedItem);

		// Update order values
		newSections.forEach((section, i) => {
			section.order = i;
		});

		sections = newSections;
		draggedIndex = null;
		dropTargetIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dropTargetIndex = null;
	}

	function toggleSection(sectionId: DashboardSectionId) {
		sections = sections.map(s =>
			s.id === sectionId ? { ...s, enabled: !s.enabled } : s
		);
	}

	function updateSmartCollectionShelf(shelfId: number | undefined) {
		sections = sections.map(s =>
			s.id === 'smart-collection'
				? { ...s, shelfId, customFilter: undefined }
				: s
		);
	}

	function updateCompanionSection(companionSection: 'up-next-series' | 'smart-collection' | 'none') {
		sections = sections.map(s =>
			s.id === 'continue-reading'
				? { ...s, companionSection }
				: s
		);
	}

	function updateCompanionShelf(shelfId: number | undefined) {
		sections = sections.map(s =>
			s.id === 'continue-reading'
				? { ...s, shelfId }
				: s
		);
	}

	function getContinueReadingSection(): DashboardSection | undefined {
		return sections.find(s => s.id === 'continue-reading');
	}

	async function handleSave() {
		saving = true;
		try {
			const newConfig: DashboardConfig = {
				sections: sections.map((s, i) => ({ ...s, order: i }))
			};
			await onSave(newConfig);
			onClose();
		} finally {
			saving = false;
		}
	}

	function getSmartSection(): DashboardSection | undefined {
		return sections.find(s => s.id === 'smart-collection');
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
		onclick={onClose}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
			style="background-color: var(--bg-secondary);"
			transition:scale={{ duration: 150, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--border-color);">
				<h2 class="text-xl font-semibold" style="color: var(--text-primary);">Dashboard Settings</h2>
				<button
					type="button"
					class="p-2 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
					style="color: var(--text-muted);"
					onclick={onClose}
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				<p class="text-sm mb-4" style="color: var(--text-muted);">
					Drag sections to reorder. Toggle to show or hide.
				</p>

				<!-- Section list -->
				<div class="space-y-2">
					{#each sections as section, index (section.id)}
						<div
							class="flex items-center gap-3 p-3 rounded-lg border transition-all"
							style="
								background-color: {dropTargetIndex === index ? 'var(--bg-hover)' : 'var(--bg-primary)'};
								border-color: {dropTargetIndex === index ? 'var(--accent)' : 'var(--border-color)'};
								opacity: {draggedIndex === index ? '0.5' : '1'};
							"
							draggable="true"
							ondragstart={(e) => handleDragStart(e, index)}
							ondragover={(e) => handleDragOver(e, index)}
							ondragleave={handleDragLeave}
							ondrop={(e) => handleDrop(e, index)}
							ondragend={handleDragEnd}
							role="listitem"
						>
							<!-- Drag handle -->
							<div class="cursor-grab active:cursor-grabbing" style="color: var(--text-muted);">
								<GripVertical class="w-5 h-5" />
							</div>

							<!-- Icon -->
							<span class="text-lg">{sectionIcons[section.id]}</span>

							<!-- Label -->
							<span class="flex-1 font-medium" style="color: var(--text-primary);">
								{sectionLabels[section.id]}
							</span>

							<!-- Toggle -->
							<button
								type="button"
								class="relative w-11 h-6 rounded-full transition-colors"
								style="background-color: {section.enabled ? 'var(--accent)' : 'var(--bg-tertiary)'};"
								onclick={() => toggleSection(section.id)}
								aria-pressed={section.enabled}
								aria-label="Toggle {sectionLabels[section.id]}"
							>
								<span
									class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
									style="transform: translateX({section.enabled ? '20px' : '0'});"
								></span>
							</button>
						</div>

						<!-- Currently Reading companion section config -->
						{#if section.id === 'continue-reading' && section.enabled}
							<div
								class="ml-8 p-3 rounded-lg border"
								style="background-color: var(--bg-primary); border-color: var(--border-color);"
							>
								<div class="flex items-center gap-2 mb-2">
									<span class="text-sm font-medium" style="color: var(--text-primary);">
										Show beside Currently Reading
									</span>
								</div>

								<select
									class="w-full px-3 py-2 rounded-lg border text-sm mb-2"
									style="
										background-color: var(--bg-secondary);
										border-color: var(--border-color);
										color: var(--text-primary);
									"
									value={section.companionSection || 'up-next-series'}
									onchange={(e) => updateCompanionSection(e.currentTarget.value as 'up-next-series' | 'smart-collection' | 'none')}
								>
									<option value="up-next-series">Up Next in Series (default)</option>
									<option value="smart-collection">Smart Collection</option>
									<option value="none">Nothing (full width)</option>
								</select>

								<!-- Show Magic Shelf selector when smart-collection is selected as companion -->
								{#if section.companionSection === 'smart-collection'}
									{#if magicShelves.length > 0}
										<select
											class="w-full px-3 py-2 rounded-lg border text-sm"
											style="
												background-color: var(--bg-secondary);
												border-color: var(--border-color);
												color: var(--text-primary);
											"
											value={section.shelfId || ''}
											onchange={(e) => updateCompanionShelf(
												e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined
											)}
										>
											<option value="">-- Select a shelf --</option>
											{#each magicShelves as shelf}
												<option value={shelf.id}>{shelf.name}</option>
											{/each}
										</select>
									{:else}
										<p class="text-sm" style="color: var(--text-muted);">
											No Magic Shelves found. <a href="/shelves" class="underline" style="color: var(--accent);">Create one</a> first.
										</p>
									{/if}
								{/if}
							</div>
						{/if}

						<!-- Smart Collection config (shown when section is enabled) -->
						{#if section.id === 'smart-collection' && section.enabled}
							<div
								class="ml-8 p-3 rounded-lg border"
								style="background-color: var(--bg-primary); border-color: var(--border-color);"
							>
								<div class="flex items-center gap-2 mb-2">
									<Sparkles class="w-4 h-4" style="color: var(--accent);" />
									<span class="text-sm font-medium" style="color: var(--text-primary);">
										Select Magic Shelf
									</span>
								</div>

								{#if magicShelves.length > 0}
									<select
										class="w-full px-3 py-2 rounded-lg border text-sm"
										style="
											background-color: var(--bg-secondary);
											border-color: var(--border-color);
											color: var(--text-primary);
										"
										value={section.shelfId || ''}
										onchange={(e) => updateSmartCollectionShelf(
											e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined
										)}
									>
										<option value="">-- Select a shelf --</option>
										{#each magicShelves as shelf}
											<option value={shelf.id}>{shelf.name}</option>
										{/each}
									</select>
								{:else}
									<p class="text-sm" style="color: var(--text-muted);">
										No Magic Shelves found. <a href="/shelves" class="underline" style="color: var(--accent);">Create one</a> first.
									</p>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-3 px-6 py-4 border-t" style="border-color: var(--border-color);">
				<button
					type="button"
					class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
					style="color: var(--text-muted);"
					onclick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn-accent"
					onclick={handleSave}
					disabled={saving}
				>
					{saving ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</div>
	</div>
{/if}
