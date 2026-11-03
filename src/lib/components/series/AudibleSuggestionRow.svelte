<script lang="ts">
	import { Plus, Check, ExternalLink, Loader2 } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import type { AudibleSuggestion } from '$lib/types';
	import { isPrerelease, formatReleaseTooltip } from '$lib/utils/date';
	import { toasts } from '$lib/stores/toast';

	let {
		suggestion,
		seriesId,
		canAdd = false
	}: {
		suggestion: AudibleSuggestion;
		seriesId: number;
		/** ADD_BOOKS: shows the + button */
		canAdd?: boolean;
	} = $props();

	let adding = $state(false);
	let added = $state<{ id: number; title: string } | null>(null);

	const prerelease = $derived(isPrerelease(suggestion.releaseDate));
	const people = $derived(
		[suggestion.authors.join(', '), suggestion.narrators.length ? `Narrated by ${suggestion.narrators.join(', ')}` : '']
			.filter(Boolean)
			.join(' · ')
	);

	function formatRuntime(min: number | null): string | null {
		if (!min || min <= 0) return null;
		const h = Math.floor(min / 60);
		const m = min % 60;
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}
	const runtime = $derived(formatRuntime(suggestion.runtimeMin));

	async function add() {
		if (adding || added) return;
		adding = true;
		try {
			const res = await fetch(`/api/series/${seriesId}/audible/add`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ asin: suggestion.asin })
			});
			const body = await res.json().catch(() => null);
			if (res.status === 201 || res.status === 200) {
				added = body.book;
				toasts.success(res.status === 201 ? `Added "${body.book.title}"` : `You already have "${body.book.title}"`);
				await invalidateAll();
			} else {
				toasts.error(body?.message || 'Could not add this book');
			}
		} catch {
			toasts.error('Could not add this book');
		} finally {
			adding = false;
		}
	}
</script>

<div class="suggestion-row">
	<div class="cover-thumb">
		<img
			src={suggestion.coverUrl || '/placeholder.png'}
			alt={suggestion.title}
			loading="lazy"
			referrerpolicy="no-referrer"
			onerror={(e) => { (e.currentTarget as HTMLImageElement).onerror = null; (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
		/>
	</div>
	<div class="title-info">
		<h3 class="book-title">
			{#if suggestion.sequenceLabel}
				<span class="seq-badge">Book {suggestion.sequenceLabel}</span>
			{/if}
			{suggestion.title}{#if suggestion.subtitle}<span class="subtitle">: {suggestion.subtitle}</span>{/if}
		</h3>
		<div class="meta-line">
			{#if prerelease}
				<span class="prerelease-chip" title={formatReleaseTooltip(suggestion.releaseDate)}>Pre-release</span>
			{/if}
			{#if people}
				<span class="book-author">{people}</span>
			{/if}
			{#if runtime}
				<span class="runtime">{runtime}</span>
			{/if}
		</div>
	</div>
	<div class="actions">
		<a
			href={suggestion.audibleUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="audible-link"
			title="Open on Audible"
			aria-label="Open {suggestion.title} on Audible"
		>
			<ExternalLink class="w-4 h-4" />
		</a>
		{#if added}
			<a href="/books/{added.id}" class="added-link" title="Open the book">
				<Check class="w-4 h-4" />
				Added
			</a>
		{:else if canAdd}
			<button
				type="button"
				class="add-btn"
				onclick={add}
				disabled={adding}
				title="Add to my library"
				aria-label="Add {suggestion.title} to my library"
			>
				{#if adding}
					<Loader2 class="w-4 h-4 animate-spin" />
				{:else}
					<Plus class="w-4 h-4" />
				{/if}
			</button>
		{/if}
	</div>
</div>

<style>
	.suggestion-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		border: 1px dashed var(--border-color);
		border-radius: 0.5rem;
		opacity: 0.65;
		transition: opacity 0.15s ease;
	}

	.suggestion-row:hover,
	.suggestion-row:focus-within {
		opacity: 1;
	}

	.cover-thumb {
		position: relative;
		width: 2rem;
		height: 2.75rem;
		border-radius: 0.25rem;
		overflow: hidden;
		flex-shrink: 0;
		background-color: var(--bg-tertiary);
	}

	.cover-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.title-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 0.125rem;
	}

	.book-title {
		font-weight: 500;
		font-size: 0.875rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0;
		line-height: 1.25;
	}

	.subtitle {
		font-weight: 400;
		color: var(--text-secondary);
	}

	.seq-badge {
		display: inline-block;
		margin-right: 0.375rem;
		padding: 0.0625rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-secondary);
		background-color: var(--bg-tertiary);
		vertical-align: 1px;
	}

	.meta-line {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.book-author {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.runtime {
		flex-shrink: 0;
		white-space: nowrap;
	}

	.runtime::before {
		content: '·';
		margin-right: 0.375rem;
	}

	.prerelease-chip {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		padding: 0.0625rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 600;
		color: #212529;
		background-color: #ffc107;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.audible-link,
	.add-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.375rem;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.audible-link:hover,
	.add-btn:hover:not(:disabled) {
		color: var(--text-primary);
		background: var(--bg-hover);
	}

	.add-btn {
		cursor: pointer;
		color: var(--accent);
	}

	.add-btn:disabled {
		cursor: wait;
	}

	.added-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--success, #198754);
	}
</style>
