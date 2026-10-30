<script lang="ts">
	import { browser } from '$app/environment';
	import { ChevronRight } from 'lucide-svelte';

	interface NoteBook {
		id: number;
		title: string;
		bookNum: number | null;
		comments: string;
		completedDate: string | null;
		lastReadAt: string | null;
		startReadingDate: string | null;
	}

	// Read-only digest of the notes on a series' books; each book's notes are edited on its own page
	let { seriesId, books }: { seriesId: number; books: NoteBook[] } = $props();

	function activityTime(b: NoteBook): number | null {
		const value = b.completedDate ?? b.lastReadAt ?? b.startReadingDate;
		if (!value) return null;
		const t = Date.parse(value);
		return Number.isNaN(t) ? null : t;
	}

	// The book with the latest reading activity, ties going to the later book in the series
	const lastRead = $derived.by(() => {
		let best: NoteBook | null = null;
		let bestTime = -Infinity;
		for (const b of books) {
			const t = activityTime(b);
			if (t === null) continue;
			if (t > bestTime || (t === bestTime && (b.bookNum ?? -Infinity) > (best?.bookNum ?? -Infinity))) {
				best = b;
				bestTime = t;
			}
		}
		return best;
	});

	const others = $derived(books.filter((b) => b.id !== lastRead?.id));

	const storageKey = $derived(`series-notes-digest-open-${seriesId}`);
	let storedOpen = $state<boolean | null>(null);
	$effect(() => {
		if (!browser) return;
		const v = localStorage.getItem(storageKey);
		storedOpen = v === null ? null : v === 'true';
	});
	const open = $derived(storedOpen ?? others.length <= 3);

	function toggle() {
		storedOpen = !open;
		if (browser) localStorage.setItem(storageKey, String(storedOpen));
	}

	function label(b: NoteBook): string {
		return b.bookNum != null ? `Book #${b.bookNum} — ${b.title}` : b.title;
	}
</script>

{#if books.length > 0}
	<div class="mt-4 pt-3 border-t" style="border-color: var(--border-color);">
		<h3 class="text-xs font-semibold uppercase tracking-wide mb-2" style="color: var(--text-muted);">
			Notes from the books in this series
		</h3>

		{#if lastRead}
			<div class="mb-3">
				<a href="/books/{lastRead.id}" class="text-sm font-medium hover:underline" style="color: var(--text-primary);">
					{label(lastRead)}
				</a>
				<p class="text-sm whitespace-pre-wrap mt-1" style="color: var(--text-secondary);">{lastRead.comments}</p>
			</div>
		{/if}

		{#if others.length > 0}
			<button
				type="button"
				class="flex items-center gap-1 text-sm hover:underline"
				style="color: var(--text-secondary);"
				aria-expanded={open}
				onclick={toggle}
			>
				Notes from {others.length} {lastRead ? 'other ' : ''}{others.length === 1 ? 'book' : 'books'}
				<ChevronRight class="w-3.5 h-3.5 transition-transform {open ? 'rotate-90' : ''}" />
			</button>
			{#if open}
				<div class="mt-2 space-y-3">
					{#each others as b (b.id)}
						<div>
							<a href="/books/{b.id}" class="text-sm font-medium hover:underline" style="color: var(--text-primary);">
								{label(b)}
							</a>
							<p class="text-sm whitespace-pre-wrap mt-1" style="color: var(--text-secondary);">{b.comments}</p>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/if}
