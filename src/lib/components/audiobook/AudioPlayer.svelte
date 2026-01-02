<script lang="ts">
	import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Rewind, FastForward, ChevronDown, ChevronUp, Bookmark, BookmarkPlus, Clock, X, List, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';

	interface AudioTrack {
		id: number;
		filename: string;
		filePath: string;
		duration: number;
		startOffset: number;
		trackNumber: number;
		title?: string | null;
	}

	interface AudioChapter {
		id: number;
		audiobookId: number;
		title: string;
		startTime: number;
		endTime: number | null;
		chapterNumber: number;
	}

	interface AudioBookmark {
		id: number;
		audiobookId: number;
		userId: number;
		time: number;
		title: string | null;
		note: string | null;
		createdAt: string | null;
	}

	interface Props {
		audiobookId: number;
		title: string;
		author?: string | null;
		coverPath?: string | null;
		tracks: AudioTrack[];
		chapters?: AudioChapter[];
		initialTime?: number;
		initialPlaybackRate?: number;
		onProgressUpdate?: (currentTime: number, currentFileId: number, playbackRate: number) => void;
		onEnded?: () => void;
	}

	let {
		audiobookId,
		title,
		author = null,
		coverPath = null,
		tracks,
		chapters: initialChapters = [],
		initialTime = 0,
		initialPlaybackRate = 1,
		onProgressUpdate,
		onEnded
	}: Props = $props();

	// Audio element reference
	let audioElement: HTMLAudioElement;

	// Player state
	let isPlaying = $state(false);
	let currentTime = $state(initialTime);
	let duration = $state(0);
	let volume = $state(1);
	let isMuted = $state(false);
	let playbackRate = $state(initialPlaybackRate);
	let isLoading = $state(true);
	let isExpanded = $state(true);
	let showVolumeSlider = $state(false);

	// Track management
	let currentTrackIndex = $state(0);
	let currentTrack = $derived(tracks[currentTrackIndex]);

	// Bookmark state
	let bookmarks = $state<AudioBookmark[]>([]);
	let showBookmarks = $state(false);
	let isAddingBookmark = $state(false);
	let newBookmarkTitle = $state('');

	// Sleep timer state
	let sleepTimerMinutes = $state<number | null>(null);
	let sleepTimerEndTime = $state<number | null>(null);
	let sleepTimerRemaining = $state<number>(0);
	let showSleepTimer = $state(false);
	let sleepTimerInterval: ReturnType<typeof setInterval> | null = null;

	// Sleep timer presets in minutes
	const sleepTimerPresets = [5, 10, 15, 30, 45, 60, 90];

	// Chapter state
	let chapters = $state<AudioChapter[]>(initialChapters);
	let showChapters = $state(false);

	// Progress update interval
	let progressInterval: ReturnType<typeof setInterval> | null = null;

	// Calculate total duration
	const totalDuration = $derived(
		tracks.reduce((acc, track) => acc + track.duration, 0)
	);

	// Get absolute current time (across all tracks)
	const absoluteCurrentTime = $derived(
		currentTrack ? currentTrack.startOffset + currentTime : 0
	);

	// Progress percentage
	const progressPercent = $derived(
		totalDuration > 0 ? (absoluteCurrentTime / totalDuration) * 100 : 0
	);

	// Current chapter based on position
	const currentChapter = $derived(() => {
		if (chapters.length === 0) return null;
		for (let i = chapters.length - 1; i >= 0; i--) {
			if (absoluteCurrentTime >= chapters[i].startTime) {
				return chapters[i];
			}
		}
		return chapters[0];
	});

	// Current chapter index
	const currentChapterIndex = $derived(() => {
		const chapter = currentChapter();
		if (!chapter) return -1;
		return chapters.findIndex(c => c.id === chapter.id);
	});

	// Playback rate options
	const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

	// Format time helper
	function formatTime(seconds: number): string {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hrs > 0) {
			return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Find track index for a given absolute time
	function findTrackForTime(absoluteTime: number): number {
		for (let i = tracks.length - 1; i >= 0; i--) {
			if (absoluteTime >= tracks[i].startOffset) {
				return i;
			}
		}
		return 0;
	}

	// Seek to absolute time
	function seekToAbsoluteTime(absoluteTime: number) {
		const trackIndex = findTrackForTime(absoluteTime);
		const track = tracks[trackIndex];
		const trackTime = absoluteTime - track.startOffset;

		if (trackIndex !== currentTrackIndex) {
			currentTrackIndex = trackIndex;
			loadTrack(trackIndex, trackTime);
		} else if (audioElement) {
			audioElement.currentTime = Math.max(0, Math.min(trackTime, track.duration));
		}
	}

	// Load a track
	function loadTrack(index: number, startTime = 0) {
		if (!tracks[index]) return;

		isLoading = true;
		const track = tracks[index];
		const streamUrl = `/api/audiobooks/${audiobookId}/stream/${track.id}`;

		if (audioElement) {
			const wasPlaying = isPlaying;
			audioElement.src = streamUrl;
			audioElement.currentTime = startTime;
			audioElement.playbackRate = playbackRate;

			audioElement.onloadedmetadata = async () => {
				isLoading = false;
				duration = audioElement.duration;
				if (wasPlaying) {
					try {
						await audioElement.play();
					} catch (err) {
						console.warn('[AudioPlayer] Auto-play after track load prevented:', err);
					}
				}
			};
		}
	}

	// Play/Pause toggle
	async function togglePlay() {
		if (!audioElement) return;

		if (isPlaying) {
			audioElement.pause();
		} else {
			try {
				await audioElement.play();
			} catch (err) {
				// Handle autoplay restriction on mobile
				console.warn('[AudioPlayer] Play was prevented:', err);
				// On mobile, we may need user interaction first
				// The play attempt should still work on subsequent taps
			}
		}
	}

	// Skip forward/backward
	function skip(seconds: number) {
		const newAbsoluteTime = Math.max(0, Math.min(absoluteCurrentTime + seconds, totalDuration));
		seekToAbsoluteTime(newAbsoluteTime);
	}

	// Go to next track
	function nextTrack() {
		if (currentTrackIndex < tracks.length - 1) {
			currentTrackIndex++;
			loadTrack(currentTrackIndex, 0);
		}
	}

	// Go to previous track
	function prevTrack() {
		if (currentTime > 3) {
			// If more than 3 seconds in, restart current track
			if (audioElement) {
				audioElement.currentTime = 0;
			}
		} else if (currentTrackIndex > 0) {
			currentTrackIndex--;
			loadTrack(currentTrackIndex, 0);
		}
	}

	// Toggle mute
	function toggleMute() {
		isMuted = !isMuted;
		if (audioElement) {
			audioElement.muted = isMuted;
		}
	}

	// Set volume
	function setVolume(newVolume: number) {
		volume = newVolume;
		if (audioElement) {
			audioElement.volume = newVolume;
		}
		if (newVolume > 0 && isMuted) {
			isMuted = false;
			audioElement.muted = false;
		}
	}

	// Set playback rate
	function setPlaybackRate(rate: number) {
		playbackRate = rate;
		if (audioElement) {
			audioElement.playbackRate = rate;
		}
	}

	// Handle progress bar click
	function handleProgressClick(e: MouseEvent) {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const newAbsoluteTime = percent * totalDuration;
		seekToAbsoluteTime(newAbsoluteTime);
	}

	// Report progress to parent
	function reportProgress() {
		if (onProgressUpdate && currentTrack) {
			onProgressUpdate(absoluteCurrentTime, currentTrack.id, playbackRate);
		}
	}

	// Bookmark functions
	async function loadBookmarks() {
		try {
			const res = await fetch(`/api/audiobooks/${audiobookId}/bookmarks`);
			if (res.ok) {
				const data = await res.json();
				bookmarks = data.bookmarks || [];
			}
		} catch (err) {
			console.error('[AudioPlayer] Failed to load bookmarks:', err);
		}
	}

	async function addBookmark() {
		if (isAddingBookmark) return;
		isAddingBookmark = true;

		try {
			const res = await fetch(`/api/audiobooks/${audiobookId}/bookmarks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					time: absoluteCurrentTime,
					title: newBookmarkTitle.trim() || `Bookmark at ${formatTime(absoluteCurrentTime)}`
				})
			});

			if (res.ok) {
				const data = await res.json();
				bookmarks = [...bookmarks, data.bookmark].sort((a, b) => a.time - b.time);
				newBookmarkTitle = '';
				showBookmarks = true;
			}
		} catch (err) {
			console.error('[AudioPlayer] Failed to add bookmark:', err);
		} finally {
			isAddingBookmark = false;
		}
	}

	async function removeBookmark(bookmarkId: number) {
		try {
			const res = await fetch(`/api/audiobooks/${audiobookId}/bookmarks`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bookmarkId })
			});

			if (res.ok) {
				bookmarks = bookmarks.filter(b => b.id !== bookmarkId);
			}
		} catch (err) {
			console.error('[AudioPlayer] Failed to delete bookmark:', err);
		}
	}

	function jumpToBookmark(bookmark: AudioBookmark) {
		seekToAbsoluteTime(bookmark.time);
		showBookmarks = false;
	}

	// Sleep timer functions
	function startSleepTimer(minutes: number) {
		// Clear any existing timer
		clearSleepTimer();

		sleepTimerMinutes = minutes;
		sleepTimerEndTime = Date.now() + minutes * 60 * 1000;
		sleepTimerRemaining = minutes * 60;
		showSleepTimer = false;

		sleepTimerInterval = setInterval(() => {
			if (sleepTimerEndTime) {
				sleepTimerRemaining = Math.max(0, Math.ceil((sleepTimerEndTime - Date.now()) / 1000));

				if (sleepTimerRemaining <= 0) {
					// Time's up - pause playback
					if (audioElement && isPlaying) {
						audioElement.pause();
					}
					clearSleepTimer();
				}
			}
		}, 1000);
	}

	function clearSleepTimer() {
		if (sleepTimerInterval) {
			clearInterval(sleepTimerInterval);
			sleepTimerInterval = null;
		}
		sleepTimerMinutes = null;
		sleepTimerEndTime = null;
		sleepTimerRemaining = 0;
	}

	function formatTimerRemaining(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Chapter navigation functions
	async function loadChapters() {
		try {
			const res = await fetch(`/api/audiobooks/${audiobookId}/chapters`);
			if (res.ok) {
				const data = await res.json();
				chapters = data.chapters || [];
			}
		} catch (err) {
			console.error('[AudioPlayer] Failed to load chapters:', err);
		}
	}

	function jumpToChapter(chapter: AudioChapter) {
		seekToAbsoluteTime(chapter.startTime);
		showChapters = false;
	}

	function nextChapter() {
		const idx = currentChapterIndex();
		if (idx < chapters.length - 1) {
			jumpToChapter(chapters[idx + 1]);
		}
	}

	function prevChapter() {
		const chapter = currentChapter();
		const idx = currentChapterIndex();

		// If more than 3 seconds into current chapter, restart it
		if (chapter && absoluteCurrentTime - chapter.startTime > 3) {
			jumpToChapter(chapter);
		} else if (idx > 0) {
			// Go to previous chapter
			jumpToChapter(chapters[idx - 1]);
		} else if (chapter) {
			// At first chapter, restart it
			jumpToChapter(chapter);
		}
	}

	// Initialize on mount
	onMount(() => {
		// Load bookmarks for this audiobook
		loadBookmarks();

		// Load chapters if not provided
		if (chapters.length === 0) {
			loadChapters();
		}

		// Find initial track based on initialTime
		if (initialTime > 0) {
			const trackIndex = findTrackForTime(initialTime);
			currentTrackIndex = trackIndex;
			const trackTime = initialTime - tracks[trackIndex].startOffset;
			loadTrack(trackIndex, trackTime);
		} else if (tracks.length > 0) {
			loadTrack(0, 0);
		}

		// Set up progress reporting interval
		progressInterval = setInterval(() => {
			if (isPlaying) {
				reportProgress();
			}
		}, 10000); // Report every 10 seconds

		// Keyboard shortcuts
		function handleKeydown(e: KeyboardEvent) {
			// Ignore if typing in input
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			switch (e.code) {
				case 'Space':
					e.preventDefault();
					togglePlay();
					break;
				case 'ArrowLeft':
					e.preventDefault();
					skip(-10);
					break;
				case 'ArrowRight':
					e.preventDefault();
					skip(30);
					break;
				case 'ArrowUp':
					e.preventDefault();
					setVolume(Math.min(1, volume + 0.1));
					break;
				case 'ArrowDown':
					e.preventDefault();
					setVolume(Math.max(0, volume - 0.1));
					break;
				case 'BracketLeft':
					e.preventDefault();
					const lowerRate = playbackRates[Math.max(0, playbackRates.indexOf(playbackRate) - 1)];
					if (lowerRate) setPlaybackRate(lowerRate);
					break;
				case 'BracketRight':
					e.preventDefault();
					const higherRate = playbackRates[Math.min(playbackRates.length - 1, playbackRates.indexOf(playbackRate) + 1)];
					if (higherRate) setPlaybackRate(higherRate);
					break;
				case 'KeyB':
					e.preventDefault();
					addBookmark();
					break;
				case 'KeyM':
					e.preventDefault();
					showBookmarks = !showBookmarks;
					break;
				case 'KeyC':
					e.preventDefault();
					showChapters = !showChapters;
					break;
				case 'Comma':
					e.preventDefault();
					if (chapters.length > 0) prevChapter();
					break;
				case 'Period':
					e.preventDefault();
					if (chapters.length > 0) nextChapter();
					break;
			}
		}

		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	onDestroy(() => {
		if (progressInterval) {
			clearInterval(progressInterval);
		}
		// Clear sleep timer
		clearSleepTimer();
		// Report final progress
		reportProgress();
	});

	// Audio element event handlers
	function onTimeUpdate() {
		if (audioElement) {
			currentTime = audioElement.currentTime;
		}
	}

	function onPlay() {
		isPlaying = true;
	}

	function onPause() {
		isPlaying = false;
		reportProgress();
	}

	async function onTrackEnded() {
		if (currentTrackIndex < tracks.length - 1) {
			// Go to next track
			currentTrackIndex++;
			loadTrack(currentTrackIndex, 0);
			if (isPlaying && audioElement) {
				try {
					await audioElement.play();
				} catch (err) {
					console.warn('[AudioPlayer] Auto-play next track prevented:', err);
				}
			}
		} else {
			// Audiobook finished
			isPlaying = false;
			if (onEnded) {
				onEnded();
			}
		}
	}

	function onError() {
		console.error('[AudioPlayer] Error loading audio');
		isLoading = false;
	}
</script>

<div class="audio-player" class:collapsed={!isExpanded}>
	<!-- Hidden audio element -->
	<audio
		bind:this={audioElement}
		ontimeupdate={onTimeUpdate}
		onplay={onPlay}
		onpause={onPause}
		onended={onTrackEnded}
		onerror={onError}
	></audio>

	{#if isExpanded}
		<!-- Expanded Player -->
		<div class="player-expanded">
			<!-- Cover and info -->
			<div class="player-info">
				{#if coverPath}
					<img
						src={coverPath}
						alt={title}
						class="player-cover"
						onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
					/>
				{:else}
					<div class="player-cover-placeholder">
						<span class="text-2xl">🎧</span>
					</div>
				{/if}
				<div class="player-text">
					<div class="player-title">{title}</div>
					{#if author}
						<div class="player-author">{author}</div>
					{/if}
					{#if chapters.length > 0 && currentChapter()}
						<div class="player-chapter">{currentChapter()?.title}</div>
					{:else if currentTrack?.title}
						<div class="player-track">{currentTrack.title}</div>
					{/if}
				</div>
			</div>

			<!-- Progress bar -->
			<div class="progress-container">
				<button
					class="progress-bar"
					onclick={handleProgressClick}
					type="button"
					aria-label="Seek"
				>
					<div class="progress-fill" style="width: {progressPercent}%"></div>
				</button>
				<div class="progress-times">
					<span>{formatTime(absoluteCurrentTime)}</span>
					<span>{formatTime(totalDuration)}</span>
				</div>
			</div>

			<!-- Controls -->
			<div class="player-controls">
				<!-- Skip back 10s -->
				<button onclick={() => skip(-10)} class="control-btn" title="Rewind 10s">
					<Rewind class="w-5 h-5" />
				</button>

				<!-- Previous track -->
				<button onclick={prevTrack} class="control-btn" title="Previous">
					<SkipBack class="w-5 h-5" />
				</button>

				<!-- Play/Pause -->
				<button
					onclick={togglePlay}
					class="control-btn play-btn"
					disabled={isLoading}
					title={isPlaying ? 'Pause' : 'Play'}
				>
					{#if isLoading}
						<div class="loading-spinner"></div>
					{:else if isPlaying}
						<Pause class="w-6 h-6" />
					{:else}
						<Play class="w-6 h-6 ml-0.5" />
					{/if}
				</button>

				<!-- Next track -->
				<button onclick={nextTrack} class="control-btn" title="Next">
					<SkipForward class="w-5 h-5" />
				</button>

				<!-- Skip forward 30s -->
				<button onclick={() => skip(30)} class="control-btn" title="Forward 30s">
					<FastForward class="w-5 h-5" />
				</button>
			</div>

			<!-- Secondary controls -->
			<div class="player-secondary">
				<!-- Chapter controls -->
				{#if chapters.length > 0}
					<div class="chapter-control">
						<button
							onclick={prevChapter}
							class="control-btn-sm"
							title="Previous chapter (,)"
						>
							<ChevronLeft class="w-4 h-4" />
						</button>
						<button
							onclick={() => showChapters = !showChapters}
							class="control-btn-sm chapter-btn"
							class:active={showChapters}
							title="Chapters (C)"
						>
							<List class="w-4 h-4" />
							<span class="chapter-indicator">{currentChapterIndex() + 1}/{chapters.length}</span>
						</button>
						<button
							onclick={nextChapter}
							class="control-btn-sm"
							title="Next chapter (.)"
							disabled={currentChapterIndex() >= chapters.length - 1}
						>
							<ChevronRight class="w-4 h-4" />
						</button>
					</div>
				{/if}

				<!-- Bookmark controls -->
				<div class="bookmark-control">
					<button
						onclick={addBookmark}
						class="control-btn-sm"
						title="Add bookmark (B)"
						disabled={isAddingBookmark}
					>
						<BookmarkPlus class="w-4 h-4" />
					</button>
					<button
						onclick={() => showBookmarks = !showBookmarks}
						class="control-btn-sm"
						class:active={showBookmarks}
						title="Show bookmarks (M)"
					>
						<Bookmark class="w-4 h-4" />
						{#if bookmarks.length > 0}
							<span class="bookmark-count">{bookmarks.length}</span>
						{/if}
					</button>
				</div>

				<!-- Sleep timer -->
				<div class="sleep-timer-control">
					{#if sleepTimerMinutes}
						<button
							onclick={clearSleepTimer}
							class="sleep-timer-active"
							title="Cancel sleep timer"
						>
							<Clock class="w-4 h-4" />
							<span class="timer-remaining">{formatTimerRemaining(sleepTimerRemaining)}</span>
						</button>
					{:else}
						<button
							onclick={() => showSleepTimer = !showSleepTimer}
							class="control-btn-sm"
							class:active={showSleepTimer}
							title="Sleep timer"
						>
							<Clock class="w-4 h-4" />
						</button>
					{/if}
				</div>

				<!-- Speed control -->
				<div class="speed-control">
					<select
						value={playbackRate}
						onchange={(e) => setPlaybackRate(parseFloat((e.target as HTMLSelectElement).value))}
						class="speed-select"
					>
						{#each playbackRates as rate}
							<option value={rate}>{rate}x</option>
						{/each}
					</select>
				</div>

				<!-- Volume control -->
				<div class="volume-control">
					<button onclick={toggleMute} class="control-btn-sm" title={isMuted ? 'Unmute' : 'Mute'}>
						{#if isMuted || volume === 0}
							<VolumeX class="w-4 h-4" />
						{:else}
							<Volume2 class="w-4 h-4" />
						{/if}
					</button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={isMuted ? 0 : volume}
						oninput={(e) => setVolume(parseFloat((e.target as HTMLInputElement).value))}
						class="volume-slider"
					/>
				</div>

				<!-- Collapse button -->
				<button onclick={() => isExpanded = false} class="control-btn-sm" title="Minimize">
					<ChevronDown class="w-4 h-4" />
				</button>
			</div>

			<!-- Chapters dropdown -->
			{#if showChapters && chapters.length > 0}
				<div class="chapters-panel">
					<div class="chapters-header">
						<span class="chapters-title">Chapters</span>
						<button onclick={() => showChapters = false} class="control-btn-sm">
							<X class="w-4 h-4" />
						</button>
					</div>
					<div class="chapters-list">
						{#each chapters as chapter, i (chapter.id)}
							<button
								class="chapter-item"
								class:active={currentChapterIndex() === i}
								onclick={() => jumpToChapter(chapter)}
							>
								<span class="chapter-number">{chapter.chapterNumber}</span>
								<span class="chapter-name">{chapter.title}</span>
								<span class="chapter-time">{formatTime(chapter.startTime)}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Bookmarks dropdown -->
			{#if showBookmarks}
				<div class="bookmarks-panel">
					<div class="bookmarks-header">
						<span class="bookmarks-title">Bookmarks</span>
						<button onclick={() => showBookmarks = false} class="control-btn-sm">
							<X class="w-4 h-4" />
						</button>
					</div>
					{#if bookmarks.length === 0}
						<div class="bookmarks-empty">
							No bookmarks yet. Press <kbd>B</kbd> to add one.
						</div>
					{:else}
						<div class="bookmarks-list">
							{#each bookmarks as bookmark (bookmark.id)}
								<div class="bookmark-item">
									<button
										class="bookmark-jump"
										onclick={() => jumpToBookmark(bookmark)}
										title="Jump to bookmark"
									>
										<span class="bookmark-time">{formatTime(bookmark.time)}</span>
										<span class="bookmark-label">{bookmark.title || 'Bookmark'}</span>
									</button>
									<button
										class="bookmark-delete"
										onclick={() => removeBookmark(bookmark.id)}
										title="Delete bookmark"
									>
										<X class="w-3 h-3" />
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Sleep timer dropdown -->
			{#if showSleepTimer}
				<div class="sleep-timer-panel">
					<div class="sleep-timer-header">
						<span class="sleep-timer-title">Sleep Timer</span>
						<button onclick={() => showSleepTimer = false} class="control-btn-sm">
							<X class="w-4 h-4" />
						</button>
					</div>
					<div class="sleep-timer-options">
						{#each sleepTimerPresets as minutes}
							<button
								class="sleep-timer-option"
								onclick={() => startSleepTimer(minutes)}
							>
								{minutes} min
							</button>
						{/each}
					</div>
					<div class="sleep-timer-hint">
						Playback will pause after the timer ends
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Collapsed Player (mini bar) -->
		<div class="player-collapsed">
			<div class="mini-progress" style="width: {progressPercent}%"></div>

			<div class="mini-info">
				<span class="mini-title">{title}</span>
				<span class="mini-time">{formatTime(absoluteCurrentTime)} / {formatTime(totalDuration)}</span>
			</div>

			<div class="mini-controls">
				<button onclick={togglePlay} class="control-btn-sm" disabled={isLoading}>
					{#if isPlaying}
						<Pause class="w-4 h-4" />
					{:else}
						<Play class="w-4 h-4" />
					{/if}
				</button>
				<button onclick={() => isExpanded = true} class="control-btn-sm">
					<ChevronUp class="w-4 h-4" />
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.audio-player {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		/* Solid opaque background - fallback to dark if CSS vars not set */
		background: var(--bg-primary, #1a1a2e);
		border-top: 1px solid var(--border-color, #2d2d44);
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
		/* Ensure backdrop is fully opaque */
		backdrop-filter: none;
	}

	/* Extra safety: ensure no transparency */
	.audio-player::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--bg-primary, #1a1a2e);
		z-index: -1;
	}

	.player-expanded {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.player-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.player-cover {
		width: 40px;
		height: 40px;
		object-fit: cover;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.player-cover-placeholder {
		width: 40px;
		height: 40px;
		background: var(--bg-secondary, #252542);
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.player-text {
		flex: 1;
		min-width: 0;
	}

	.player-title {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary, #ffffff);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.player-author {
		font-size: 0.75rem;
		color: var(--text-muted, #8888aa);
	}

	.player-track {
		font-size: 0.625rem;
		color: var(--text-muted, #8888aa);
		opacity: 0.8;
		display: none;
	}

	.progress-container {
		width: 100%;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: var(--bg-tertiary, #333355);
		border-radius: 4px;
		cursor: pointer;
		position: relative;
		overflow: hidden;
		border: none;
		padding: 0;
		touch-action: none;
	}

	.progress-bar:hover,
	.progress-bar:active {
		height: 10px;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent, #3b82f6);
		border-radius: 4px;
		transition: width 0.1s ease;
	}

	.progress-times {
		display: flex;
		justify-content: space-between;
		font-size: 0.625rem;
		color: var(--text-muted, #8888aa);
		margin-top: 0.25rem;
	}

	.player-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
	}

	.control-btn {
		width: 36px;
		height: 36px;
		border: none;
		background: transparent;
		color: var(--text-primary, #ffffff);
		cursor: pointer;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.control-btn:hover,
	.control-btn:active {
		background: var(--bg-secondary, #252542);
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.play-btn {
		width: 48px;
		height: 48px;
		background: var(--accent, #3b82f6);
		color: white;
	}

	.play-btn:hover,
	.play-btn:active {
		background: var(--accent-hover, #2563eb);
	}

	.control-btn-sm {
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		color: var(--text-muted, #8888aa);
		cursor: pointer;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.control-btn-sm:hover,
	.control-btn-sm:active {
		background: var(--bg-secondary, #252542);
		color: var(--text-primary, #ffffff);
	}

	.player-secondary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}

	.speed-control {
		display: flex;
		align-items: center;
	}

	.speed-select {
		background: var(--bg-secondary, #252542);
		border: 1px solid var(--border-color, #2d2d44);
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		color: var(--text-primary, #ffffff);
		cursor: pointer;
		min-width: 50px;
	}

	.volume-control {
		display: none;
		align-items: center;
		gap: 0.5rem;
	}

	.volume-slider {
		width: 80px;
		height: 4px;
		-webkit-appearance: none;
		background: var(--bg-tertiary, #333355);
		border-radius: 2px;
		cursor: pointer;
	}

	.volume-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		background: var(--accent, #3b82f6);
		border-radius: 50%;
		cursor: pointer;
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Collapsed state */
	.player-collapsed {
		height: 56px;
		display: flex;
		align-items: center;
		padding: 0 1rem;
		position: relative;
	}

	.mini-progress {
		position: absolute;
		top: 0;
		left: 0;
		height: 3px;
		background: var(--accent, #3b82f6);
	}

	.mini-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.mini-title {
		font-weight: 500;
		font-size: 0.875rem;
		color: var(--text-primary, #ffffff);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mini-time {
		font-size: 0.625rem;
		color: var(--text-muted, #8888aa);
		white-space: nowrap;
	}

	.mini-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Bookmark styles */
	.bookmark-control {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		position: relative;
	}

	.bookmark-count {
		position: absolute;
		top: -4px;
		right: -4px;
		background: var(--accent, #3b82f6);
		color: white;
		font-size: 0.625rem;
		min-width: 14px;
		height: 14px;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 3px;
	}

	.control-btn-sm.active {
		background: var(--bg-secondary, #252542);
		color: var(--accent, #3b82f6);
	}

	.bookmarks-panel {
		position: absolute;
		bottom: 100%;
		right: 1rem;
		width: 280px;
		max-height: 300px;
		background: var(--bg-primary, #1a1a2e);
		border: 1px solid var(--border-color, #2d2d44);
		border-radius: 8px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
		margin-bottom: 0.5rem;
		overflow: hidden;
		z-index: 60;
	}

	.bookmarks-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-color, #2d2d44);
	}

	.bookmarks-title {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary, #ffffff);
	}

	.bookmarks-empty {
		padding: 1.5rem 1rem;
		text-align: center;
		color: var(--text-muted, #8888aa);
		font-size: 0.875rem;
	}

	.bookmarks-empty kbd {
		background: var(--bg-secondary, #252542);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.75rem;
	}

	.bookmarks-list {
		max-height: 220px;
		overflow-y: auto;
	}

	.bookmark-item {
		display: flex;
		align-items: center;
		border-bottom: 1px solid var(--border-color, #2d2d44);
	}

	.bookmark-item:last-child {
		border-bottom: none;
	}

	.bookmark-jump {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-primary, #ffffff);
		text-align: left;
		transition: background 0.2s;
	}

	.bookmark-jump:hover {
		background: var(--bg-secondary, #252542);
	}

	.bookmark-time {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--accent, #3b82f6);
		min-width: 60px;
	}

	.bookmark-label {
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bookmark-delete {
		padding: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted, #8888aa);
		border-radius: 4px;
		margin-right: 0.5rem;
		transition: all 0.2s;
	}

	.bookmark-delete:hover {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	/* Sleep timer styles */
	.sleep-timer-control {
		position: relative;
	}

	.sleep-timer-active {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: var(--accent, #3b82f6);
		border: none;
		border-radius: 9999px;
		cursor: pointer;
		color: white;
		font-size: 0.75rem;
		transition: all 0.2s;
	}

	.sleep-timer-active:hover {
		background: var(--accent-hover, #2563eb);
	}

	.timer-remaining {
		font-family: monospace;
		font-weight: 500;
	}

	.sleep-timer-panel {
		position: absolute;
		bottom: 100%;
		right: 0;
		width: 220px;
		background: var(--bg-primary, #1a1a2e);
		border: 1px solid var(--border-color, #2d2d44);
		border-radius: 8px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
		margin-bottom: 0.5rem;
		overflow: hidden;
		z-index: 60;
	}

	.sleep-timer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-color, #2d2d44);
	}

	.sleep-timer-title {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary, #ffffff);
	}

	.sleep-timer-options {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		padding: 0.75rem;
	}

	.sleep-timer-option {
		padding: 0.5rem;
		background: var(--bg-secondary, #252542);
		border: 1px solid var(--border-color, #2d2d44);
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-primary, #ffffff);
		font-size: 0.75rem;
		transition: all 0.2s;
	}

	.sleep-timer-option:hover {
		background: var(--accent, #3b82f6);
		border-color: var(--accent, #3b82f6);
	}

	.sleep-timer-hint {
		padding: 0.5rem 0.75rem 0.75rem;
		font-size: 0.625rem;
		color: var(--text-muted, #8888aa);
		text-align: center;
	}

	/* Chapter styles */
	.chapter-control {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}

	.chapter-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		width: auto;
	}

	.chapter-indicator {
		font-size: 0.75rem;
		font-weight: 500;
	}

	.player-chapter {
		font-size: 0.75rem;
		color: var(--accent, #3b82f6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chapters-panel {
		position: absolute;
		bottom: 100%;
		left: 1rem;
		right: 1rem;
		max-width: 400px;
		max-height: 350px;
		background: var(--bg-primary, #1a1a2e);
		border: 1px solid var(--border-color, #2d2d44);
		border-radius: 8px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
		margin-bottom: 0.5rem;
		overflow: hidden;
		z-index: 60;
	}

	.chapters-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-color, #2d2d44);
	}

	.chapters-title {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary, #ffffff);
	}

	.chapters-list {
		max-height: 280px;
		overflow-y: auto;
	}

	.chapter-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-color, #2d2d44);
		cursor: pointer;
		color: var(--text-primary, #ffffff);
		text-align: left;
		transition: background 0.2s;
	}

	.chapter-item:last-child {
		border-bottom: none;
	}

	.chapter-item:hover {
		background: var(--bg-secondary, #252542);
	}

	.chapter-item.active {
		background: var(--bg-secondary, #252542);
		border-left: 3px solid var(--accent, #3b82f6);
	}

	.chapter-number {
		font-size: 0.75rem;
		color: var(--text-muted, #8888aa);
		min-width: 24px;
		text-align: center;
	}

	.chapter-name {
		flex: 1;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chapter-time {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--text-muted, #8888aa);
	}

	/* Tablet and up - wider layout */
	@media (min-width: 640px) {
		.player-expanded {
			padding: 1rem 1.5rem;
			gap: 0.75rem;
		}

		.player-cover {
			width: 48px;
			height: 48px;
		}

		.player-cover-placeholder {
			width: 48px;
			height: 48px;
		}

		.player-title {
			font-size: 1rem;
		}

		.player-author {
			font-size: 0.875rem;
		}

		.player-track {
			display: block;
		}

		.player-chapter {
			display: block;
		}

		.progress-times {
			font-size: 0.75rem;
		}

		.control-btn {
			width: 40px;
			height: 40px;
		}

		.play-btn {
			width: 56px;
			height: 56px;
		}

		.player-controls {
			gap: 0.5rem;
		}

		.volume-control {
			display: flex;
		}

		.player-secondary {
			justify-content: flex-end;
			gap: 1rem;
		}

		.speed-select {
			font-size: 0.875rem;
			min-width: 60px;
		}

		.mini-info {
			flex-direction: row;
			align-items: center;
			gap: 1rem;
		}
	}

	/* Desktop - horizontal layout */
	@media (min-width: 768px) {
		.player-expanded {
			flex-direction: row;
			align-items: center;
			gap: 1.5rem;
		}

		.player-info {
			flex: 0 0 auto;
			max-width: 280px;
		}

		.progress-container {
			flex: 1;
		}

		.player-controls {
			flex: 0 0 auto;
		}

		.player-secondary {
			flex: 0 0 auto;
		}
	}

	/* Large desktop */
	@media (min-width: 1024px) {
		.player-info {
			max-width: 350px;
		}

		.player-cover {
			width: 56px;
			height: 56px;
		}

		.player-cover-placeholder {
			width: 56px;
			height: 56px;
		}
	}
</style>
