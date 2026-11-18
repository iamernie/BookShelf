<script lang="ts">
	import { X, Headphones, ExternalLink, Loader2 } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';
	import { pushLayer } from '$lib/utils/layers';

	interface Props {
		open: boolean;
		/** The Audiobookshelf item page: the same URL the Listen link opens */
		src: string;
		/** Book title for the header; the header reads "Audiobookshelf" without one */
		bookTitle?: string;
		onClose: () => void;
	}

	let { open, src, bookTitle = '', onClose }: Props = $props();

	$effect(() => {
		if (open) return pushLayer(() => onClose());
	});

	// A drag that starts inside the panel and ends on the backdrop isn't a backdrop click
	let pressStartedOnBackdrop = false;

	// The frame mounts with the modal, so every open starts in the loading state until it fires load
	let loaded = $state(false);
	$effect(() => {
		if (open) loaded = false;
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-0 sm:p-4"
		transition:fade={{ duration: 150 }}
		onmousedown={(e) => { pressStartedOnBackdrop = e.target === e.currentTarget; }}
		onclick={(e) => { if (e.target === e.currentTarget && pressStartedOnBackdrop) onClose(); }}
		role="dialog"
		aria-modal="true"
		aria-label="Audiobookshelf player"
	>
		<div
			class="shadow-2xl w-full h-full rounded-none sm:rounded-xl sm:w-[90vw] sm:h-[85vh] flex flex-col overflow-hidden"
			style="background-color: var(--bg-secondary);"
			transition:scale={{ duration: 150, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b" style="border-color: var(--border-color);">
				<div class="flex items-center gap-3 min-w-0">
					<Headphones class="w-5 h-5 flex-shrink-0" style="color: var(--accent);" />
					<h2 class="text-lg sm:text-xl font-semibold truncate" style="color: var(--text-primary);">{bookTitle || 'Audiobookshelf'}</h2>
				</div>
				<div class="flex items-center gap-1 flex-shrink-0">
					<a
						href={src}
						target="_blank"
						rel="noopener"
						class="btn-ghost flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm"
						title="Open in Audiobookshelf"
						aria-label="Open in Audiobookshelf"
					>
						<ExternalLink class="w-4 h-4" />
						<span class="hidden sm:inline">Open in Audiobookshelf</span>
					</a>
					<button
						type="button"
						class="p-2 rounded-lg transition-colors"
						style="color: var(--text-muted);"
						onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
						onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
						onclick={onClose}
						aria-label="Close player"
					>
						<X class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Player: Audiobookshelf's own item page, with its player, chapters and details -->
			<div class="relative flex-1 min-h-0">
				{#if !loaded}
					<div class="absolute inset-0 flex flex-col items-center justify-center gap-3" style="color: var(--text-muted);" role="status">
						<Loader2 class="w-8 h-8 animate-spin" style="color: var(--accent);" />
						<span class="text-sm">Loading Audiobookshelf…</span>
					</div>
				{/if}
				<iframe
					{src}
					allow="autoplay; fullscreen"
					title="Audiobookshelf player"
					class="absolute inset-0 w-full h-full border-0"
					onload={() => { loaded = true; }}
				></iframe>
			</div>
		</div>
	</div>
{/if}
