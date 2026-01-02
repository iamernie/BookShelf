<script lang="ts">
	import { BookOpen } from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';

	let {
		status,
		onclick
	}: {
		status: {
			id: number;
			name: string;
			color: string | null;
			icon: string | null;
			bookCount: number;
		};
		onclick: () => void;
	} = $props();
</script>

<button
	type="button"
	class="status-card"
	onclick={onclick}
>
	<div class="flex items-center gap-4">
		<div
			class="status-icon-wrapper"
			style="background-color: {status.color || '#6c757d'}20"
		>
			<span style="color: {status.color || '#6c757d'}">
				<DynamicIcon icon={status.icon} size={24} />
			</span>
		</div>

		<div class="flex-1 min-w-0">
			<h3 class="status-name">{status.name}</h3>
			<p class="status-count">
				<BookOpen class="w-4 h-4" />
				{status.bookCount} {status.bookCount === 1 ? 'book' : 'books'}
			</p>
		</div>

		<div
			class="status-indicator"
			style="background-color: {status.color || '#6c757d'}"
		></div>
	</div>
</button>

<style>
	.status-card {
		background-color: var(--bg-secondary);
		border-radius: 0.75rem;
		border: 1px solid var(--border-color);
		padding: 1rem;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: all 0.2s ease;
	}

	.status-card:hover {
		background-color: var(--bg-hover);
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.status-icon-wrapper {
		width: 3rem;
		height: 3rem;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-name {
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status-count {
		font-size: 0.875rem;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}

	.status-indicator {
		width: 1rem;
		height: 1rem;
		border-radius: 9999px;
		border: 2px solid var(--bg-primary);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
</style>
