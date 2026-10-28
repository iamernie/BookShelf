<script lang="ts">
	import { Loader2, Search, Unlink, AlertTriangle, RefreshCw } from 'lucide-svelte';
	import AbsLinkModal from './AbsLinkModal.svelte';
	import AbsItemDetails from './AbsItemDetails.svelte';
	import { toasts } from '$lib/stores/toast';

	interface Props {
		bookId: number;
		absItemId: string | null;
		absBaseUrl: string;
		/** Pre-filled search for Find / Change link */
		initialQuery?: string;
		/** When the sync last found the linked item gone (404); null = not stale */
		absLinkStaleAt?: string | null;
		/** Called after a link, relink or unlink is saved (changes apply immediately) */
		onChange: (absItemId: string | null) => void;
	}

	let { bookId, absItemId, absBaseUrl, initialQuery = '', absLinkStaleAt = null, onChange }: Props = $props();

	let showLinkModal = $state(false);
	let unlinking = $state(false);
	let rechecking = $state(false);
	// Local copy so Re-check can update the badge without a reload
	let staleSince = $state<string | null>(null);
	$effect(() => {
		staleSince = absLinkStaleAt;
	});

	async function recheck() {
		rechecking = true;
		try {
			const res = await fetch(`/api/admin/abs/links/${bookId}/verify`, { method: 'POST' });
			const body = await res.json();
			if (!res.ok) throw new Error(body.message || 'Re-check failed');
			if (body.found) {
				staleSince = null;
				toasts.success('Found on Audiobookshelf');
			} else {
				staleSince = staleSince ?? new Date().toISOString();
				toasts.error('Not found on Audiobookshelf');
			}
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Re-check failed');
		} finally {
			rechecking = false;
		}
	}

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
			{#if staleSince}
				<p class="text-xs mt-1 inline-flex items-center gap-1" style="color: #ef4444;">
					<AlertTriangle class="w-3.5 h-3.5" />
					Stale: not found on Audiobookshelf since {new Date(staleSince).toLocaleDateString()}
				</p>
			{/if}
		{:else}
			<p class="font-medium text-sm" style="color: var(--text-primary);">Not linked</p>
			<p class="text-xs" style="color: var(--text-muted);">Changes apply immediately</p>
		{/if}
	</div>
	<div class="flex gap-2">
		{#if absItemId}
			{#if staleSince}
				<button
					type="button"
					class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5"
					style="background-color: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
					onclick={recheck}
					disabled={rechecking}
				>
					{#if rechecking}<Loader2 class="w-3.5 h-3.5 animate-spin" />{:else}<RefreshCw class="w-3.5 h-3.5" />{/if}
					Re-check
				</button>
			{/if}
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
		staleSince = null;
		onChange(linkedItemId);
	}}
/>
