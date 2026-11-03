<script lang="ts">
	import { ArrowLeft, Headphones } from 'lucide-svelte';
	import AudibleSuggestionRow from '$lib/components/series/AudibleSuggestionRow.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Next Up on Audible - BookShelf</title>
</svelte:head>

<div class="page-container">
	<a href="/series" class="back-link">
		<ArrowLeft class="w-4 h-4" />
		Series
	</a>

	<div class="page-header">
		<h1 class="page-title">
			<Headphones class="w-6 h-6" />
			Next Up on Audible
		</h1>
		<p class="page-subtitle">One line per series you're reading: the highest book you own and the next one on Audible.</p>
	</div>

	{#if data.nextUp.items.length > 0}
		<div class="next-list">
			{#each data.nextUp.items as item (item.seriesId)}
				<section class="next-item">
					<p class="next-line">
						<a href="/series/{item.seriesId}" class="series-link">{item.seriesTitle}</a>
						<span class="muted">
							— {#if item.ownedThrough !== null}you own through #{item.ownedThrough} · {/if}next: {item.next.sequenceLabel ? `#${item.next.sequenceLabel} ${item.next.title}` : item.next.title}
						</span>
						{#if item.gaps > 0}
							<span class="gaps">+{item.gaps} earlier {item.gaps === 1 ? 'gap' : 'gaps'}</span>
						{/if}
					</p>
					<AudibleSuggestionRow suggestion={item.next} seriesId={item.seriesId} canAdd={data.canAddBooks} />
				</section>
			{/each}
		</div>
	{:else}
		<p class="empty">Nothing to suggest right now.</p>
	{/if}

	{#if data.nextUp.caughtUp > 0 || data.nextUp.unchecked > 0}
		<p class="footer">
			{#if data.nextUp.caughtUp > 0}{data.nextUp.caughtUp} series all caught up{/if}{#if data.nextUp.caughtUp > 0 && data.nextUp.unchecked > 0} · {/if}{#if data.nextUp.unchecked > 0}{data.nextUp.unchecked} not checked on Audible yet{/if}
		</p>
	{/if}
</div>

<style>
	.page-container {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-bottom: 1rem;
	}

	.back-link:hover {
		color: var(--text-primary);
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.page-subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.next-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.next-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.next-line {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.series-link {
		font-weight: 600;
		color: var(--text-primary);
	}

	.series-link:hover {
		color: var(--accent);
	}

	.muted {
		color: var(--text-secondary);
	}

	.gaps {
		margin-left: 0.375rem;
		padding: 0.0625rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		background-color: var(--bg-tertiary);
	}

	.empty,
	.footer {
		margin: 1.5rem 0 0;
		font-size: 0.875rem;
		color: var(--text-muted);
	}
</style>
