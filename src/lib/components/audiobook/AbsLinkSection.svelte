<script lang="ts">
	import { Loader2, Search, Unlink } from 'lucide-svelte';
	import AbsLinkModal from './AbsLinkModal.svelte';
	import AbsItemDetails from './AbsItemDetails.svelte';
	import { toasts } from '$lib/stores/toast';

	interface Props {
		bookId: number;
		absItemId: string | null;
		absBaseUrl: string;
		/** Pre-filled search for Find / Change link */
		initialQuery?: string;
		/** Called after a link, relink or unlink is saved (changes apply immediately) */
		onChange: (absItemId: string | null) => void;
	}

	let { bookId, absItemId, absBaseUrl, initialQuery = '', onChange }: Props = $props();

	let showLinkModal = $state(false);
	let unlinking = $state(false);

	async function unlink() {
		unlinking = true;
		try {
			const res = await fetch(`/api/books/${bookId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ absItemId: '' })
			});
			if (!res.ok) throw new Error();
			toasts.success('Unlinked from Audiobookshelf');
			onChange(null);
		} catch {
			toasts.error('Failed to unlink from Audiobookshelf');
		} finally {
			unlinking = false;
		}
	}
</script>

<div class="flex items-center justify-between flex-wrap gap-3">
	<div class="min-w-0">
		{#if absItemId}
			<p class="font-medium text-sm" style="color: var(--text-primary);">Linked</p>
			<p class="text-xs font-mono" style="color: var(--text-muted);" title={absItemId}>{absItemId.slice(0, 8)}</p>
		{:else}
			<p class="font-medium text-sm" style="color: var(--text-primary);">Not linked</p>
			<p class="text-xs" style="color: var(--text-muted);">Changes apply immediately</p>
		{/if}
	</div>
	<div class="flex gap-2">
		{#if absItemId}
			<button
				type="button"
				class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
				style="background-color: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
				onclick={() => showLinkModal = true}
			>
				Change link
			</button>
			<button
				type="button"
				class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5"
				style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);"
				onclick={unlink}
				disabled={unlinking}
			>
				{#if unlinking}
					<Loader2 class="w-3.5 h-3.5 animate-spin" />
				{:else}
					<Unlink class="w-3.5 h-3.5" />
				{/if}
				Unlink
			</button>
		{:else}
			<button
				type="button"
				class="btn-accent px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
				onclick={() => showLinkModal = true}
			>
				<Search class="w-3.5 h-3.5" />
				Find on Audiobookshelf
			</button>
		{/if}
	</div>
</div>

{#if absItemId}
	<AbsItemDetails {absItemId} {absBaseUrl} />
{/if}

<AbsLinkModal
	open={showLinkModal}
	{bookId}
	{initialQuery}
	onClose={() => showLinkModal = false}
	onLinked={(_bookId, linkedItemId) => {
		toasts.success('Linked to Audiobookshelf');
		onChange(linkedItemId);
	}}
/>
