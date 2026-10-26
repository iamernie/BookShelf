<script lang="ts">
	import { Loader2, ExternalLink, AlertCircle } from 'lucide-svelte';

	interface AbsItem {
		id: string;
		title: string;
		authorName: string | null;
		narratorName: string | null;
		seriesName: string | null;
		publishedYear: string | null;
		publisher: string | null;
		description: string | null;
		asin: string | null;
		durationSec: number | null;
		numChapters: number;
		numAudioFiles: number;
		sizeBytes: number | null;
		audioFormat: string | null;
		libraryId: string | null;
	}

	interface Props {
		absItemId: string;
		absBaseUrl: string;
	}

	let { absItemId, absBaseUrl }: Props = $props();

	let item = $state<AbsItem | null>(null);
	let loading = $state(false);
	let errorMessage = $state('');

	// Refetch whenever the link changes; ignore responses for a stale id
	$effect(() => {
		const id = absItemId;
		let cancelled = false;
		loading = true;
		errorMessage = '';
		item = null;
		fetch(`/api/v1/admin/abs/item/${encodeURIComponent(id)}`)
			.then(async (res) => {
				const body = await res.json().catch(() => ({}));
				if (cancelled) return;
				if (!res.ok || !body.ok) throw new Error(body.error || body.message || 'Failed to load Audiobookshelf item');
				item = body.item as AbsItem;
			})
			.catch((e) => {
				if (!cancelled) errorMessage = e instanceof Error ? e.message : 'Failed to load Audiobookshelf item';
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	function formatDuration(seconds: number): string {
		const totalMinutes = Math.round(seconds / 60);
		const h = Math.floor(totalMinutes / 60);
		const m = totalMinutes % 60;
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}

	function formatSize(bytes: number): string {
		const mb = bytes / (1024 * 1024);
		return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
	}

	const filesLabel = $derived.by(() => {
		if (!item || item.numAudioFiles === 0) return null;
		const parts = [`${item.numAudioFiles} ${item.numAudioFiles === 1 ? 'file' : 'files'}`];
		if (item.audioFormat) parts.push(item.audioFormat);
		if (item.sizeBytes) parts.push(formatSize(item.sizeBytes));
		return parts.join(' · ');
	});

	const publishedLabel = $derived(
		item ? [item.publishedYear, item.publisher].filter(Boolean).join(' · ') || null : null
	);
</script>

<div class="mt-3 pt-3" style="border-top: 1px solid var(--border-color);">
	{#if loading}
		<p class="text-xs flex items-center gap-2" style="color: var(--text-muted);">
			<Loader2 class="w-3.5 h-3.5 animate-spin" />
			Loading from Audiobookshelf...
		</p>
	{:else if errorMessage}
		<p class="text-xs flex items-center gap-2" style="color: #ef4444;">
			<AlertCircle class="w-3.5 h-3.5 shrink-0" />
			{errorMessage}
		</p>
	{:else if item}
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
			{#if item.narratorName}
				<dt style="color: var(--text-muted);">Narrator</dt>
				<dd style="color: var(--text-primary);">{item.narratorName}</dd>
			{/if}
			{#if item.seriesName}
				<dt style="color: var(--text-muted);">Series</dt>
				<dd style="color: var(--text-primary);">{item.seriesName}</dd>
			{/if}
			{#if item.durationSec}
				<dt style="color: var(--text-muted);">Duration</dt>
				<dd style="color: var(--text-primary);">{formatDuration(item.durationSec)}</dd>
			{/if}
			{#if item.numChapters > 0}
				<dt style="color: var(--text-muted);">Chapters</dt>
				<dd style="color: var(--text-primary);">{item.numChapters}</dd>
			{/if}
			{#if filesLabel}
				<dt style="color: var(--text-muted);">Files</dt>
				<dd style="color: var(--text-primary);">{filesLabel}</dd>
			{/if}
			{#if publishedLabel}
				<dt style="color: var(--text-muted);">Published</dt>
				<dd style="color: var(--text-primary);">{publishedLabel}</dd>
			{/if}
		</dl>
		{#if item.description}
			<p class="text-xs mt-2 line-clamp-3" style="color: var(--text-secondary);" title={item.description}>
				{item.description}
			</p>
		{/if}
	{/if}
	<a
		href="{absBaseUrl}/item/{absItemId}"
		target="_blank"
		rel="noopener noreferrer"
		class="text-xs mt-2 inline-flex items-center gap-1 hover:underline"
		style="color: var(--accent);"
	>
		Open in Audiobookshelf
		<ExternalLink class="w-3 h-3" />
	</a>
</div>
