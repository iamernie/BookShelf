<script lang="ts">
	interface RunCounts {
		itemsScanned: number;
		linked: number;
		created: number;
		pushed: number;
		queued: number;
		skipped: number;
		staleFound: number;
		staleCleared: number;
		statusFlips: number;
		failed: number;
		mode: string;
	}

	let { run }: { run: RunCounts } = $props();

	// Preview counts are what an apply run would have done
	const verb = $derived(run.mode === 'preview' ? 'would ' : '');
	const parts = $derived(
		[
			[run.linked, `${verb}link`],
			[run.created, `${verb}create`],
			[run.pushed, `${verb}push`],
			[run.queued, 'queued'],
			[run.staleFound, 'stale'],
			[run.staleCleared, 'stale cleared'],
			[run.statusFlips, `${verb}change status`],
			[run.skipped, 'skipped'],
			[run.failed, 'failed']
		].filter(([n]) => (n as number) > 0) as [number, string][]
	);
</script>

<span class="text-sm" style="color: var(--text-secondary);">
	{run.itemsScanned} scanned{#each parts as [n, label]}<span> · <span style={label === 'failed' ? 'color: #ef4444;' : ''}>{n} {label}</span></span>{/each}
</span>
