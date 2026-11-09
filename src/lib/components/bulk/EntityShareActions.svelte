<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Globe, Lock, X } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	// Share a series, author or narrator to the public library, and (admins) un-share it. The counts
	// come from the load's dry run: shareable is the viewer's own promotable books, unshareable the
	// public books an admin would move back (0 for everyone else). Both hide when the public library is off.
	let {
		kind,
		entityId,
		enabled,
		shareable,
		unshareable
	}: {
		kind: 'series' | 'author' | 'narrator';
		entityId: number;
		enabled: boolean;
		shareable: number;
		unshareable: number;
	} = $props();

	const API: Record<typeof kind, string> = { series: 'series', author: 'authors', narrator: 'narrators' };

	let confirming = $state<'share' | 'unshare' | null>(null);
	let loading = $state(false);

	const books = (n: number) => `${n} book${n !== 1 ? 's' : ''}`;

	async function run(action: 'share' | 'unshare') {
		loading = true;
		try {
			const res = await fetch(`/api/${API[kind]}/${entityId}/share`, { method: action === 'share' ? 'POST' : 'DELETE' });
			const body = await res.json().catch(() => null);
			if (res.ok) {
				toasts.success(action === 'share'
					? `${books(body?.promoted ?? 0)} shared to the public library`
					: `${books(body?.unshared ?? 0)} moved out of the public library`);
				confirming = null;
				await invalidateAll();
			} else {
				toasts.error(body?.message || (action === 'share' ? 'Failed to share' : 'Failed to un-share'));
			}
		} catch {
			toasts.error(action === 'share' ? 'Failed to share' : 'Failed to un-share');
		} finally {
			loading = false;
		}
	}
</script>

{#if enabled && shareable > 0}
	<button
		type="button"
		class="btn-share"
		onclick={() => (confirming = 'share')}
		title="Move the books you can share in this {kind} to the public library, where every user can see them"
	>
		<Globe class="w-4 h-4" />
		Share to public library ({shareable})
	</button>
{/if}
{#if enabled && unshareable > 0}
	<button
		type="button"
		class="btn-share"
		onclick={() => (confirming = 'unshare')}
		title="Move every public book in this {kind} back to its owner's personal library"
	>
		<Lock class="w-4 h-4" />
		Un-share ({unshareable})
	</button>
{/if}

{#if confirming}
	{@const share = confirming === 'share'}
	{@const n = share ? shareable : unshareable}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && !loading && (confirming = null)}
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			onclick={() => !loading && (confirming = null)}
			aria-label="Close modal"
		></button>

		<!-- Modal -->
		<div
			class="relative w-full max-w-md rounded-xl shadow-2xl border"
			style="background-color: var(--bg-secondary); border-color: var(--border-color);"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b" style="border-color: var(--border-color);">
				<div class="flex items-center gap-2">
					{#if share}
						<Globe class="w-5 h-5" style="color: var(--accent);" />
					{:else}
						<Lock class="w-5 h-5" style="color: var(--accent);" />
					{/if}
					<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
						{share ? 'Share to public library' : 'Un-share'}
					</h2>
				</div>
				<button
					type="button"
					class="p-1 rounded hover:bg-black/10 transition-colors"
					style="color: var(--text-muted);"
					onclick={() => (confirming = null)}
					disabled={loading}
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="p-4">
				<p class="share-confirm-text text-sm" style="color: var(--text-secondary);">
					{#if share}
						{books(n)} will be visible to every user.
					{:else}
						{books(n)} will leave the public library. Members who added them keep them.
					{/if}
				</p>
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-3 p-4 border-t" style="border-color: var(--border-color);">
				<button
					type="button"
					class="btn-ghost px-4 py-2"
					onclick={() => (confirming = null)}
					disabled={loading}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-4 py-2 rounded-lg font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
					style="background-color: var(--accent);"
					onclick={() => run(share ? 'share' : 'unshare')}
					disabled={loading}
				>
					{#if loading}
						{share ? 'Sharing...' : 'Un-sharing...'}
					{:else}
						{share ? `Share ${books(n)}` : `Un-share ${books(n)}`}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.btn-share {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		background-color: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		white-space: nowrap;
	}

	.btn-share:hover {
		background-color: var(--bg-hover);
	}
</style>
