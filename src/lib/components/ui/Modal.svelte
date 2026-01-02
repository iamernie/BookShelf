<script lang="ts">
	import { X } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	let {
		open = false,
		title = '',
		size = 'md',
		onClose,
		children
	}: {
		open: boolean;
		title?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
		onClose: () => void;
		children: Snippet;
	} = $props();

	const sizeClasses: Record<string, string> = {
		sm: 'max-w-md',
		md: 'max-w-lg',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl',
		full: 'max-w-6xl'
	};

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
		onclick={onClose}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="rounded-xl shadow-2xl w-full {sizeClasses[size]} max-h-[90vh] flex flex-col"
			style="background-color: var(--bg-secondary);"
			transition:scale={{ duration: 150, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			{#if title}
				<div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--border-color);">
					<h2 class="text-xl font-semibold" style="color: var(--text-primary);">{title}</h2>
					<button
						type="button"
						class="p-2 rounded-lg transition-colors"
						style="color: var(--text-muted);"
						onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
						onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
						onclick={onClose}
					>
						<X class="w-5 h-5" />
					</button>
				</div>
			{:else}
				<button
					type="button"
					class="absolute top-4 right-4 p-2 rounded-lg transition-colors"
					style="color: var(--text-muted);"
					onmouseenter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
					onmouseleave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
					onclick={onClose}
				>
					<X class="w-5 h-5" />
				</button>
			{/if}

			<div class="flex-1 overflow-y-auto">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
