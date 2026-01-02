<script lang="ts">
	import { Headphones, Play, Pause, Clock, ChevronLeft, Trash2, Edit, Bookmark, RotateCcw, CheckCircle, List } from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import AudioPlayer from '$lib/components/audiobook/AudioPlayer.svelte';
	import { toasts } from '$lib/stores/toast';

	let { data } = $props();

	let showPlayer = $state(false);
	let showDeleteConfirm = $state(false);
	let deleting = $state(false);

	function formatDuration(seconds: number): string {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);

		if (hrs > 0) {
			return `${hrs} hr ${mins} min`;
		}
		return `${mins} min`;
	}

	function formatTime(seconds: number): string {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hrs > 0) {
			return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function getProgressPercent(): number {
		if (!data.progress) return 0;
		return Math.round((data.progress.progress ?? 0) * 100);
	}

	function getRemainingTime(): number {
		const total = data.audiobook.duration ?? 0;
		const current = data.progress?.currentTime ?? 0;
		return total - current;
	}

	async function handleProgressUpdate(currentTime: number, currentFileId: number, playbackRate: number) {
		try {
			await fetch(`/api/audiobooks/${data.audiobook.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentTime, currentFileId, playbackRate })
			});
		} catch (e) {
			console.error('Failed to save progress:', e);
		}
	}

	async function handleEnded() {
		try {
			await fetch(`/api/audiobooks/${data.audiobook.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'finish' })
			});
			toasts.success('Audiobook completed!');
			invalidateAll();
		} catch (e) {
			console.error('Failed to mark as finished:', e);
		}
	}

	async function resetProgress() {
		try {
			await fetch(`/api/audiobooks/${data.audiobook.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'reset' })
			});
			toasts.success('Progress reset');
			invalidateAll();
		} catch (e) {
			console.error('Failed to reset progress:', e);
			toasts.error('Failed to reset progress');
		}
	}

	async function markAsFinished() {
		try {
			await fetch(`/api/audiobooks/${data.audiobook.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'finish' })
			});
			toasts.success('Marked as finished');
			invalidateAll();
		} catch (e) {
			console.error('Failed to mark as finished:', e);
			toasts.error('Failed to mark as finished');
		}
	}

	async function deleteAudiobook() {
		deleting = true;
		try {
			const res = await fetch(`/api/audiobooks/${data.audiobook.id}`, { method: 'DELETE' });
			if (res.ok) {
				toasts.success('Audiobook deleted');
				goto('/audiobooks');
			} else {
				throw new Error('Failed to delete');
			}
		} catch (e) {
			console.error('Failed to delete:', e);
			toasts.error('Failed to delete audiobook');
		} finally {
			deleting = false;
			showDeleteConfirm = false;
		}
	}
</script>

<svelte:head>
	<title>{data.audiobook.title} | Audiobooks</title>
</svelte:head>

<div class="container mx-auto px-4 py-6" class:pb-40={showPlayer}>
	<!-- Header -->
	<div class="flex items-center gap-4 mb-6">
		<a href="/audiobooks" class="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
			<ChevronLeft class="w-6 h-6" style="color: var(--text-primary);" />
		</a>
		<h1 class="text-xl font-bold truncate" style="color: var(--text-primary);">
			{data.audiobook.title}
		</h1>
	</div>

	<!-- Main content -->
	<div class="grid md:grid-cols-3 gap-8">
		<!-- Cover and play button -->
		<div class="md:col-span-1">
			<div class="relative aspect-square rounded-xl overflow-hidden mb-4 shadow-lg" style="background: var(--bg-secondary);">
				{#if data.audiobook.coverPath}
					<img
						src={data.audiobook.coverPath}
						alt={data.audiobook.title}
						class="w-full h-full object-cover"
						onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
					/>
				{:else}
					<div class="w-full h-full flex items-center justify-center">
						<Headphones class="w-24 h-24" style="color: var(--text-muted);" />
					</div>
				{/if}

				<!-- Progress overlay -->
				{#if getProgressPercent() > 0 && !data.progress?.isFinished}
					<div class="absolute bottom-0 left-0 right-0 h-2" style="background: rgba(0,0,0,0.5);">
						<div
							class="h-full"
							style="width: {getProgressPercent()}%; background: var(--accent);"
						></div>
					</div>
				{/if}
			</div>

			<!-- Play button -->
			<button
				onclick={() => showPlayer = true}
				class="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-white font-semibold text-lg transition-colors mb-4"
				style="background: var(--accent);"
			>
				<Play class="w-6 h-6" />
				{#if getProgressPercent() > 0 && !data.progress?.isFinished}
					Continue Listening
				{:else if data.progress?.isFinished}
					Listen Again
				{:else}
					Start Listening
				{/if}
			</button>

			<!-- Progress info -->
			{#if getProgressPercent() > 0}
				<div class="text-center text-sm mb-4" style="color: var(--text-muted);">
					{#if data.progress?.isFinished}
						<span class="flex items-center justify-center gap-1 text-green-500">
							<CheckCircle class="w-4 h-4" />
							Completed
						</span>
					{:else}
						{getProgressPercent()}% • {formatDuration(getRemainingTime())} remaining
					{/if}
				</div>
			{/if}

			<!-- Action buttons -->
			<div class="flex items-center justify-center gap-2">
				{#if !data.progress?.isFinished && getProgressPercent() > 0}
					<button
						onclick={markAsFinished}
						class="p-2 rounded-lg transition-colors"
						style="background: var(--bg-secondary);"
						title="Mark as finished"
					>
						<CheckCircle class="w-5 h-5" style="color: var(--text-muted);" />
					</button>
				{/if}

				{#if getProgressPercent() > 0}
					<button
						onclick={resetProgress}
						class="p-2 rounded-lg transition-colors"
						style="background: var(--bg-secondary);"
						title="Reset progress"
					>
						<RotateCcw class="w-5 h-5" style="color: var(--text-muted);" />
					</button>
				{/if}

				<a
					href="/audiobooks/{data.audiobook.id}/edit"
					class="p-2 rounded-lg transition-colors"
					style="background: var(--bg-secondary);"
					title="Edit"
				>
					<Edit class="w-5 h-5" style="color: var(--text-muted);" />
				</a>

				<button
					onclick={() => showDeleteConfirm = true}
					class="p-2 rounded-lg transition-colors"
					style="background: var(--bg-secondary);"
					title="Delete"
				>
					<Trash2 class="w-5 h-5" style="color: #ef4444;" />
				</button>
			</div>
		</div>

		<!-- Info -->
		<div class="md:col-span-2">
			<h2 class="text-2xl font-bold mb-2" style="color: var(--text-primary);">
				{data.audiobook.title}
			</h2>

			{#if data.audiobook.author}
				<p class="text-lg mb-1" style="color: var(--text-muted);">
					by {data.audiobook.author}
				</p>
			{/if}

			{#if data.audiobook.narratorName}
				<p class="mb-4" style="color: var(--text-muted);">
					Narrated by {data.audiobook.narratorName}
				</p>
			{/if}

			<div class="flex flex-wrap gap-4 mb-6">
				<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background: var(--bg-secondary);">
					<Clock class="w-4 h-4" style="color: var(--text-muted);" />
					<span class="text-sm" style="color: var(--text-primary);">
						{formatDuration(data.audiobook.duration ?? 0)}
					</span>
				</div>

				{#if data.audiobook.files.length > 1}
					<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background: var(--bg-secondary);">
						<List class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-primary);">
							{data.audiobook.files.length} tracks
						</span>
					</div>
				{/if}

				{#if data.audiobook.seriesName}
					<div class="px-3 py-1.5 rounded-lg" style="background: var(--bg-secondary);">
						<span class="text-sm" style="color: var(--text-primary);">
							{data.audiobook.seriesName}
							{#if data.audiobook.seriesNumber}
								#{data.audiobook.seriesNumber}
							{/if}
						</span>
					</div>
				{/if}
			</div>

			{#if data.audiobook.description}
				<div class="mb-6">
					<h3 class="font-semibold mb-2" style="color: var(--text-primary);">Description</h3>
					<p class="text-sm leading-relaxed" style="color: var(--text-muted);">
						{data.audiobook.description}
					</p>
				</div>
			{/if}

			<!-- Chapters / Tracks -->
			{#if data.audiobook.chapters && data.audiobook.chapters.length > 0}
				<div class="mb-6">
					<h3 class="font-semibold mb-3" style="color: var(--text-primary);">Chapters</h3>
					<div class="space-y-1 max-h-64 overflow-y-auto">
						{#each data.audiobook.chapters as chapter, i}
							<div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
								<span class="text-sm" style="color: var(--text-primary);">
									{chapter.chapterNumber}. {chapter.title}
								</span>
								<span class="text-xs" style="color: var(--text-muted);">
									{formatTime(chapter.startTime)}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{:else if data.audiobook.files.length > 1}
				<div class="mb-6">
					<h3 class="font-semibold mb-3" style="color: var(--text-primary);">Tracks</h3>
					<div class="space-y-1 max-h-64 overflow-y-auto">
						{#each data.audiobook.files as file, i}
							<div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
								<span class="text-sm" style="color: var(--text-primary);">
									{file.trackNumber}. {file.title || file.filename}
								</span>
								<span class="text-xs" style="color: var(--text-muted);">
									{formatTime(file.duration)}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Bookmarks -->
			{#if data.bookmarks.length > 0}
				<div>
					<h3 class="font-semibold mb-3 flex items-center gap-2" style="color: var(--text-primary);">
						<Bookmark class="w-4 h-4" />
						Bookmarks
					</h3>
					<div class="space-y-2">
						{#each data.bookmarks as bookmark}
							<div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-secondary);">
								<div>
									<span class="text-sm font-medium" style="color: var(--text-primary);">
										{bookmark.title || 'Bookmark'}
									</span>
									{#if bookmark.note}
										<p class="text-xs" style="color: var(--text-muted);">{bookmark.note}</p>
									{/if}
								</div>
								<span class="text-xs" style="color: var(--text-muted);">
									{formatTime(bookmark.time)}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Audio Player (fixed at bottom) -->
{#if showPlayer}
	<AudioPlayer
		audiobookId={data.audiobook.id}
		title={data.audiobook.title}
		author={data.audiobook.author}
		coverPath={data.audiobook.coverPath}
		tracks={data.audiobook.files.map(f => ({
			id: f.id,
			filename: f.filename,
			filePath: f.filePath,
			duration: f.duration,
			startOffset: f.startOffset ?? 0,
			trackNumber: f.trackNumber,
			title: f.title
		}))}
		initialTime={data.progress?.currentTime ?? 0}
		initialPlaybackRate={data.progress?.playbackRate ?? 1}
		onProgressUpdate={handleProgressUpdate}
		onEnded={handleEnded}
	/>
{/if}

<!-- Delete confirmation modal -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.5);">
		<div class="rounded-xl p-6 max-w-md w-full shadow-xl" style="background: var(--card-bg);">
			<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">Delete Audiobook</h3>
			<p class="mb-6" style="color: var(--text-muted);">
				Are you sure you want to delete "{data.audiobook.title}"? This will permanently remove the audiobook and all its files.
			</p>
			<div class="flex justify-end gap-3">
				<button
					onclick={() => showDeleteConfirm = false}
					class="px-4 py-2 rounded-lg"
					style="background: var(--bg-secondary); color: var(--text-primary);"
					disabled={deleting}
				>
					Cancel
				</button>
				<button
					onclick={deleteAudiobook}
					class="px-4 py-2 rounded-lg text-white"
					style="background: #ef4444;"
					disabled={deleting}
				>
					{deleting ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}
