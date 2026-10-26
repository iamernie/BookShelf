<script lang="ts">
	import { Search, Loader2, Headphones, Link } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	interface AbsSearchResult {
		id: string;
		title: string;
		authorName: string | null;
		narratorName: string | null;
		asin: string | null;
	}

	interface Props {
		open: boolean;
		bookId: number | null;
		initialQuery?: string;
		onClose: () => void;
		onLinked: (bookId: number, absItemId: string) => void;
	}

	let { open, bookId, initialQuery = '', onClose, onLinked }: Props = $props();

	let query = $state('');
	let results = $state<AbsSearchResult[]>([]);
	let searched = $state(false);
	let searching = $state(false);
	let linkingId = $state<string | null>(null);
	let errorMessage = $state('');

	// Reset and search with the pre-filled title each time the panel opens
	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) {
			const initial = initialQuery;
			untrack(() => {
				query = initial;
				results = [];
				searched = false;
				errorMessage = '';
				linkingId = null;
				if (initial.trim()) search();
			});
		}
		wasOpen = open;
	});

	async function search() {
		searching = true;
		errorMessage = '';
		try {
			const res = await fetch(`/api/v1/admin/abs/search?q=${encodeURIComponent(query.trim())}&limit=20`);
			const body = await res.json();
			if (!res.ok) throw new Error(body.message || 'Search failed');
			results = body as AbsSearchResult[];
			searched = true;
		} catch (e) {
			results = [];
			errorMessage = e instanceof Error ? e.message : 'Search failed';
		} finally {
			searching = false;
		}
	}

	async function link(item: AbsSearchResult) {
		if (bookId === null) return;
		linkingId = item.id;
		errorMessage = '';
		try {
			const res = await fetch(`/api/books/${bookId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ absItemId: item.id })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || 'Failed to link book');
			}
			onLinked(bookId, item.id);
			onClose();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to link book';
		} finally {
			linkingId = null;
		}
	}
</script>

<Modal {open} title="Find on Audiobookshelf" size="lg" {onClose}>
	<div class="p-6 space-y-4">
		<!-- Not a <form>: this modal can render inside the book edit form, and forms can't nest -->
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={query}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						search();
					}
				}}
				placeholder="Search by title, author, or ASIN"
				class="flex-1 px-3 py-2 rounded-lg text-sm"
				style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);"
			/>
			<button type="button" class="btn-accent flex items-center gap-2 px-4 py-2 text-sm" onclick={search} disabled={searching}>
				{#if searching}
					<Loader2 class="w-4 h-4 animate-spin" />
				{:else}
					<Search class="w-4 h-4" />
				{/if}
				Search
			</button>
		</div>

		{#if errorMessage}
			<p class="text-sm" style="color: #ef4444;">{errorMessage}</p>
		{/if}

		{#if searched && results.length === 0 && !errorMessage}
			<p class="text-sm" style="color: var(--text-muted);">No matching items on Audiobookshelf.</p>
		{/if}

		{#if results.length > 0}
			<ul class="space-y-1">
				{#each results as item (item.id)}
					<li>
						<button
							type="button"
							class="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors"
							style="background: var(--bg-tertiary);"
							onmouseenter={(e) => e.currentTarget.style.outline = '1px solid var(--accent)'}
							onmouseleave={(e) => e.currentTarget.style.outline = 'none'}
							onclick={() => link(item)}
							disabled={linkingId !== null}
						>
							<Headphones class="w-4 h-4 flex-shrink-0" style="color: var(--accent);" />
							<div class="flex-1 min-w-0">
								<div class="font-medium truncate" style="color: var(--text-primary);">{item.title || 'Untitled'}</div>
								<div class="text-xs truncate" style="color: var(--text-muted);">
									{item.authorName || 'Unknown author'}{#if item.narratorName} · Narrated by {item.narratorName}{/if}{#if item.asin} · {item.asin}{/if}
								</div>
							</div>
							{#if linkingId === item.id}
								<Loader2 class="w-4 h-4 animate-spin" style="color: var(--text-muted);" />
							{:else}
								<Link class="w-4 h-4" style="color: var(--text-muted);" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Modal>
