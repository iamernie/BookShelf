<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { onMount } from 'svelte';
	import {
		X,
		Sparkles,
		Bug,
		Shield,
		Rocket,
		AlertTriangle,
		BookOpen,
		Code,
		Database,
		CheckCircle,
		RefreshCw,
		Trash2,
		Star,
		ChevronRight
	} from 'lucide-svelte';
	import type { ChangelogVersion } from '$lib/server/services/changelogService';

	interface Props {
		version: string;
		changelog: ChangelogVersion | null;
		onClose: () => void;
	}

	let { version, changelog, onClose }: Props = $props();

	let open = $state(false);
	let dontShowAgain = $state(false);

	const LAST_SEEN_KEY = 'bookshelf_last_seen_version';
	const DISMISSED_KEY = 'bookshelf_version_dismissed';

	onMount(() => {
		// Check if we should show the modal
		const lastSeenVersion = localStorage.getItem(LAST_SEEN_KEY);
		const dismissedVersion = localStorage.getItem(DISMISSED_KEY);

		// Show if version is different from last seen AND not explicitly dismissed
		if (changelog && lastSeenVersion !== version && dismissedVersion !== version) {
			// Small delay for smoother UX
			setTimeout(() => {
				open = true;
			}, 500);
		}
	});

	function handleClose() {
		// Update last seen version
		localStorage.setItem(LAST_SEEN_KEY, version);

		// If "don't show again" is checked, also mark as dismissed
		if (dontShowAgain) {
			localStorage.setItem(DISMISSED_KEY, version);
		}

		open = false;
		onClose();
	}

	// Map section title to icon component
	function getIconComponent(iconName: string) {
		const icons: Record<string, typeof Sparkles> = {
			Bug,
			Sparkles,
			Shield,
			Rocket,
			AlertTriangle,
			BookOpen,
			Code,
			Database,
			CheckCircle,
			RefreshCw,
			Trash2,
			Star
		};
		return icons[iconName] || CheckCircle;
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}
</script>

{#if open && changelog}
	<div
		class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
		onclick={handleClose}
		role="dialog"
		aria-modal="true"
		aria-labelledby="whats-new-title"
	>
		<div
			class="rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
			style="background-color: var(--bg-secondary);"
			transition:scale={{ duration: 200, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4"
				style="background: linear-gradient(135deg, var(--accent), var(--accent-hover));"
			>
				<div class="flex items-center gap-3">
					<Sparkles class="w-6 h-6 text-white" />
					<div>
						<h2 id="whats-new-title" class="text-xl font-bold text-white">What's New</h2>
						<div class="flex items-center gap-2 text-white/80 text-sm">
							<span class="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
								v{changelog.version}
							</span>
							{#if changelog.date}
								<span>{formatDate(changelog.date)}</span>
							{/if}
						</div>
					</div>
				</div>
				<button
					type="button"
					class="p-2 rounded-lg transition-colors hover:bg-white/20 text-white"
					onclick={handleClose}
					aria-label="Close"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#each changelog.sections as section}
					{@const IconComponent = getIconComponent(section.title.includes('Add') ? 'Sparkles' :
						section.title.includes('Fix') ? 'Bug' :
						section.title.includes('Change') ? 'RefreshCw' :
						section.title.includes('Highlight') ? 'Star' :
						section.title.includes('Security') ? 'Shield' :
						section.title.includes('Remove') ? 'Trash2' :
						section.title.includes('Deprecat') ? 'AlertTriangle' :
						section.title.includes('Performance') || section.title.includes('Improve') ? 'Rocket' :
						'CheckCircle')}
					<div class="mb-6 last:mb-0">
						<div class="flex items-center gap-2 mb-3">
							<div
								class="w-8 h-8 rounded-lg flex items-center justify-center"
								style="background-color: color-mix(in srgb, var(--accent) 15%, transparent);"
							>
								<svelte:component this={IconComponent} class="w-4 h-4" style="color: var(--accent);" />
							</div>
							<h3 class="text-lg font-semibold" style="color: var(--text-primary);">
								{section.title}
							</h3>
						</div>

						<div class="space-y-3 ml-10">
							{#each section.items as item}
								<div>
									<div class="flex items-start gap-2">
										<ChevronRight class="w-4 h-4 mt-0.5 flex-shrink-0" style="color: var(--accent);" />
										<div>
											<span class="font-medium" style="color: var(--text-primary);">
												{item.title}
											</span>
											{#if item.description}
												<span style="color: var(--text-secondary);">
													{' '}- {item.description}
												</span>
											{/if}
										</div>
									</div>

									{#if item.subItems && item.subItems.length > 0}
										<ul class="mt-2 ml-6 space-y-1">
											{#each item.subItems as subItem}
												<li class="text-sm flex items-start gap-2" style="color: var(--text-muted);">
													<span class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style="background-color: var(--text-muted);"></span>
													<span>{subItem}</span>
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t flex items-center justify-between" style="border-color: var(--border-color);">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={dontShowAgain}
						class="w-4 h-4 rounded border-2 cursor-pointer"
						style="border-color: var(--border-color); accent-color: var(--accent);"
					/>
					<span class="text-sm" style="color: var(--text-muted);">
						Don't show again for this version
					</span>
				</label>

				<div class="flex items-center gap-3">
					<a
						href="/admin/changelog"
						class="text-sm hover:underline"
						style="color: var(--accent);"
						onclick={handleClose}
					>
						View full changelog
					</a>
					<button
						type="button"
						class="btn-accent px-4 py-2"
						onclick={handleClose}
					>
						Got it!
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
