<script lang="ts">
	import { ExternalLink, Link2, Plus, EyeOff, RotateCcw, Loader2 } from 'lucide-svelte';

	interface Candidate {
		bookId: number;
		title: string;
		author: string | null;
		formatName: string | null;
		tier: string;
		linkedTo: string | null;
	}

	interface AttentionItem {
		id: number;
		absItemId: string;
		kind: string;
		status: string;
		itemTitle: string | null;
		itemAuthor: string | null;
		itemNarrator: string | null;
		itemAsin: string | null;
		itemIsbn: string | null;
		tier: string | null;
		candidates: Candidate[];
		resolution: string | null;
		resolvedBookId: number | null;
		updatedAt: string;
	}

	interface Props {
		item: AttentionItem;
		absBaseUrl: string | null;
		busy: boolean;
		onAction: (id: number, body: Record<string, unknown>) => void;
	}

	let { item, absBaseUrl, busy, onAction }: Props = $props();

	const kindLabel: Record<string, string> = {
		ambiguous_match: 'Several possible books',
		duplicate_link: 'Linked to several books',
		deleted_book: 'Book was deleted'
	};
	const tierLabel: Record<string, string> = {
		asin: 'ASIN',
		isbn: 'ISBN',
		title: 'title',
		core: 'title before subtitle',
		base: 'title without number'
	};
</script>

<div class="p-4 space-y-3">
	<div class="flex items-start justify-between gap-4 flex-wrap">
		<div class="min-w-0">
			<p class="text-xs font-medium uppercase tracking-wide" style="color: #f59e0b;">
				{kindLabel[item.kind] ?? item.kind}{#if item.tier} · matched by {tierLabel[item.tier] ?? item.tier}{/if}
			</p>
			<p class="font-medium" style="color: var(--text-primary);">{item.itemTitle || 'Untitled item'}</p>
			<p class="text-sm" style="color: var(--text-muted);">
				{item.itemAuthor || 'Unknown author'}{#if item.itemNarrator} · narrated by {item.itemNarrator}{/if}{#if item.itemAsin} · ASIN {item.itemAsin}{/if}{#if item.itemIsbn} · ISBN {item.itemIsbn}{/if}
			</p>
			<p class="text-xs font-mono mt-0.5" style="color: var(--text-muted);">
				{item.absItemId}
				{#if absBaseUrl}
					<a href="{absBaseUrl}/item/{item.absItemId}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 ml-2 font-sans underline" style="color: var(--accent);">
						Open in Audiobookshelf <ExternalLink class="w-3 h-3" />
					</a>
				{/if}
			</p>
		</div>
		<div class="flex gap-2 flex-shrink-0">
			{#if busy}
				<Loader2 class="w-4 h-4 animate-spin" style="color: var(--text-muted);" />
			{/if}
			{#if item.status === 'open' && item.kind === 'ambiguous_match'}
				<button type="button" class="btn-secondary text-xs px-3 py-1 flex items-center gap-1" disabled={busy} onclick={() => onAction(item.id, { action: 'create' })}>
					<Plus class="w-3.5 h-3.5" /> Create new
				</button>
			{/if}
			{#if item.status === 'open'}
				<button type="button" class="btn-secondary text-xs px-3 py-1 flex items-center gap-1" disabled={busy} onclick={() => onAction(item.id, { action: 'ignore' })}>
					<EyeOff class="w-3.5 h-3.5" /> Ignore item
				</button>
			{:else if item.status === 'ignored'}
				<button type="button" class="btn-secondary text-xs px-3 py-1 flex items-center gap-1" disabled={busy} onclick={() => onAction(item.id, { action: 'reopen' })}>
					<RotateCcw class="w-3.5 h-3.5" /> {item.kind === 'deleted_book' ? 'Allow sync to add it again' : 'Reopen'}
				</button>
			{:else}
				<span class="text-xs" style="color: var(--text-muted);">
					{item.resolution}{#if item.resolvedBookId} · <a href="/books/{item.resolvedBookId}" class="underline">book #{item.resolvedBookId}</a>{/if}
				</span>
			{/if}
		</div>
	</div>

	{#if item.candidates.length > 0}
		<div class="rounded-lg divide-y" style="background: var(--bg-tertiary); border-color: var(--border-color);">
			{#each item.candidates as c (c.bookId)}
				<div class="px-3 py-2 flex items-center gap-3">
					<div class="flex-1 min-w-0">
						<a href="/books/{c.bookId}" class="text-sm font-medium hover:underline truncate block" style="color: var(--text-primary);">{c.title}</a>
						<p class="text-xs truncate" style="color: var(--text-muted);">
							{c.author || 'Unknown author'} · {c.formatName || 'No format'} · #{c.bookId}{#if c.linkedTo && item.kind !== 'duplicate_link'} · linked elsewhere{/if}
						</p>
					</div>
					{#if item.status === 'open' && item.kind === 'ambiguous_match'}
						<button type="button" class="btn-accent text-xs px-3 py-1 flex items-center gap-1" disabled={busy} onclick={() => onAction(item.id, { action: 'link', bookId: c.bookId })}>
							<Link2 class="w-3.5 h-3.5" /> Link to this
						</button>
					{:else if item.status === 'open' && item.kind === 'duplicate_link'}
						<button type="button" class="btn-accent text-xs px-3 py-1" disabled={busy} onclick={() => onAction(item.id, { action: 'keep', bookId: c.bookId })}>
							Keep this one
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
