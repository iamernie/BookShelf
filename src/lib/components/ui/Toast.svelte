<script lang="ts">
	import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-svelte';
	import type { Toast } from '$stores/toast';
	import { toasts } from '$stores/toast';

	let { toast }: { toast: Toast } = $props();

	const icons = {
		success: CheckCircle,
		error: AlertCircle,
		warning: AlertTriangle,
		info: Info
	};

	// Theme-aware colors using CSS variables with semantic meaning
	const bgColors = {
		success: '#10b981',
		error: '#ef4444',
		warning: '#f59e0b',
		info: '#3b82f6'
	};

	const Icon = icons[toast.type];
</script>

<div
	class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-md animate-slide-in"
	style="background-color: var(--bg-secondary); border-left: 4px solid {bgColors[toast.type]}; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"
	role="alert"
>
	<Icon class="w-5 h-5 flex-shrink-0" style="color: {bgColors[toast.type]};" />
	<p class="flex-1 text-sm font-medium" style="color: var(--text-primary);">{toast.message}</p>
	<button
		type="button"
		class="flex-shrink-0 p-1 rounded transition-colors"
		style="color: var(--text-muted);"
		onclick={() => toasts.remove(toast.id)}
	>
		<X class="w-4 h-4" />
	</button>
</div>
