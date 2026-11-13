<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';

	// A small confirm modal (same shape as the share confirm): Cancel, and a confirm button
	let {
		title,
		confirmLabel,
		busyLabel = 'Working...',
		busy = false,
		onConfirm,
		onCancel,
		children
	}: {
		title: string;
		confirmLabel: string;
		busyLabel?: string;
		busy?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
		children: Snippet;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onkeydown={(e) => e.key === 'Escape' && !busy && onCancel()}
>
	<button type="button" class="absolute inset-0 bg-black/50" onclick={() => !busy && onCancel()} aria-label="Close dialog"></button>

	<div class="relative w-full max-w-md rounded-xl shadow-2xl border" style="background-color: var(--bg-secondary); border-color: var(--border-color);">
		<div class="flex items-center justify-between p-4 border-b" style="border-color: var(--border-color);">
			<h2 class="text-lg font-semibold" style="color: var(--text-primary);">{title}</h2>
			<button type="button" class="p-1 rounded hover:bg-black/10 transition-colors" style="color: var(--text-muted);" onclick={onCancel} disabled={busy}>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="confirm-body p-4 space-y-3 text-sm" style="color: var(--text-secondary);">
			{@render children()}
		</div>

		<div class="flex justify-end gap-3 p-4 border-t" style="border-color: var(--border-color);">
			<button type="button" class="btn-ghost px-4 py-2" onclick={onCancel} disabled={busy}>Cancel</button>
			<button
				type="button"
				class="px-4 py-2 rounded-lg font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
				style="background-color: var(--accent);"
				onclick={onConfirm}
				disabled={busy}
			>
				{busy ? busyLabel : confirmLabel}
			</button>
		</div>
	</div>
</div>
