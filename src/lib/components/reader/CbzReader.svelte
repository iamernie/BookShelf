<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Maximize2,
		Minimize2,
		Settings,
		ZoomIn,
		ZoomOut,
		Loader2,
		X,
		Columns,
		Square
	} from 'lucide-svelte';

	interface Props {
		bookId: number;
		bookTitle: string;
		ebookPath: string;
		initialProgress?: {
			location: string;
			percentage: number;
			currentPage?: number;
			totalPages?: number;
		} | null;
	}

	let { bookId, bookTitle, ebookPath, initialProgress }: Props = $props();

	// State
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let currentPage = $state(0);
	let totalPages = $state(0);
	let scale = $state(1.0);
	let isFullscreen = $state(false);
	let settingsOpen = $state(false);
	let pageInputValue = $state('1');
	let displayMode = $state<'single' | 'double'>('single');
	let fitMode = $state<'width' | 'height' | 'both'>('width');

	// Image URLs and loading state
	let currentImageUrl = $state<string | null>(null);
	let nextImageUrl = $state<string | null>(null);
	let imageLoading = $state(false);

	// Reading session tracking
	let sessionId = $state<number | null>(null);

	// Theme
	let theme = $state<'light' | 'sepia' | 'dark'>('dark'); // Dark is better for comics

	let saveTimeout: ReturnType<typeof setTimeout>;
	let imageContainerEl: HTMLDivElement;

	// Theme colors
	const themeColors = {
		light: { bg: '#ffffff', text: '#1a1a1a', ui: '#f8f9fa', border: '#dee2e6' },
		sepia: { bg: '#f4ecd8', text: '#5b4636', ui: '#e8dcc8', border: '#c9b99a' },
		dark: { bg: '#1a1a1a', text: '#e9ecef', ui: '#212529', border: '#495057' }
	};

	let colors = $derived(themeColors[theme]);

	// Build image URL for a page
	function getPageUrl(pageIndex: number): string {
		return `/api/cbz/${bookId}/page/${pageIndex}`;
	}

	// Load settings from localStorage
	function loadSettings() {
		if (typeof window !== 'undefined') {
			theme = (localStorage.getItem('cbzTheme') as typeof theme) || 'dark';
			scale = parseFloat(localStorage.getItem('cbzScale') || '1.0');
			displayMode = (localStorage.getItem('cbzDisplayMode') as typeof displayMode) || 'single';
			fitMode = (localStorage.getItem('cbzFitMode') as typeof fitMode) || 'width';
		}
	}

	// Save settings to localStorage
	function saveSettings() {
		if (typeof window !== 'undefined') {
			localStorage.setItem('cbzTheme', theme);
			localStorage.setItem('cbzScale', scale.toString());
			localStorage.setItem('cbzDisplayMode', displayMode);
			localStorage.setItem('cbzFitMode', fitMode);
		}
	}

	// Initialize reader - fetch metadata
	async function initReader() {
		try {
			const res = await fetch(`/api/cbz/${bookId}/metadata`);
			if (!res.ok) {
				throw new Error('Failed to load comic metadata');
			}

			const metadata = await res.json();
			totalPages = metadata.totalPages;

			if (totalPages === 0) {
				throw new Error('No pages found in comic file');
			}

			// Restore saved position
			if (initialProgress?.currentPage !== undefined && initialProgress.currentPage < totalPages) {
				currentPage = initialProgress.currentPage;
			}

			pageInputValue = (currentPage + 1).toString();
			loading = false;

			// Load first page
			await loadPage(currentPage);
		} catch (err) {
			console.error('Error initializing CBZ reader:', err);
			errorMessage = 'Failed to load comic. The file may be corrupted or not a valid CBZ.';
			loading = false;
		}
	}

	// Load a specific page
	async function loadPage(pageIndex: number) {
		if (pageIndex < 0 || pageIndex >= totalPages) return;

		imageLoading = true;
		currentImageUrl = getPageUrl(pageIndex);

		// Preload next page
		if (pageIndex + 1 < totalPages) {
			const img = new Image();
			img.src = getPageUrl(pageIndex + 1);
			nextImageUrl = img.src;
		}

		// If double page mode, also load the next page
		if (displayMode === 'double' && pageIndex + 1 < totalPages) {
			nextImageUrl = getPageUrl(pageIndex + 1);
		} else {
			nextImageUrl = null;
		}

		imageLoading = false;
		scheduleSaveProgress();
	}

	// Navigation
	function prevPage() {
		const step = displayMode === 'double' ? 2 : 1;
		if (currentPage > 0) {
			currentPage = Math.max(0, currentPage - step);
			pageInputValue = (currentPage + 1).toString();
			loadPage(currentPage);
		}
	}

	function nextPage() {
		const step = displayMode === 'double' ? 2 : 1;
		if (currentPage < totalPages - 1) {
			currentPage = Math.min(totalPages - 1, currentPage + step);
			pageInputValue = (currentPage + 1).toString();
			loadPage(currentPage);
		}
	}

	function goToPage(page: number) {
		// Page is 1-indexed from input, convert to 0-indexed
		const pageIndex = page - 1;
		if (pageIndex >= 0 && pageIndex < totalPages) {
			currentPage = pageIndex;
			pageInputValue = page.toString();
			loadPage(currentPage);
		}
	}

	function handlePageInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const page = parseInt(target.value);
		if (!isNaN(page)) {
			goToPage(page);
		}
	}

	// Zoom
	function zoomIn() {
		scale = Math.min(scale + 0.25, 3);
		saveSettings();
	}

	function zoomOut() {
		scale = Math.max(scale - 0.25, 0.5);
		saveSettings();
	}

	function resetZoom() {
		scale = 1.0;
		saveSettings();
	}

	// Display mode toggle
	function toggleDisplayMode() {
		displayMode = displayMode === 'single' ? 'double' : 'single';
		saveSettings();
		loadPage(currentPage);
	}

	// Fullscreen
	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
	}

	// Keyboard navigation
	function handleKeyboard(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowLeft':
			case 'PageUp':
				prevPage();
				break;
			case 'ArrowRight':
			case 'PageDown':
			case ' ':
				if (!e.shiftKey) nextPage();
				break;
			case '+':
			case '=':
				zoomIn();
				break;
			case '-':
				zoomOut();
				break;
			case '0':
				resetZoom();
				break;
			case 'd':
				toggleDisplayMode();
				break;
			case 'Escape':
				settingsOpen = false;
				break;
		}
	}

	// Touch/swipe handling
	let touchStartX = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
	}

	function handleTouchEnd(e: TouchEvent) {
		const touchEndX = e.changedTouches[0].screenX;
		const diff = touchStartX - touchEndX;

		if (Math.abs(diff) > 50) {
			if (diff > 0) {
				nextPage();
			} else {
				prevPage();
			}
		}
	}

	// Click on image to advance
	function handleImageClick(e: MouseEvent) {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const clickX = e.clientX - rect.left;

		// Click on left third goes back, right two-thirds goes forward
		if (clickX < rect.width / 3) {
			prevPage();
		} else {
			nextPage();
		}
	}

	// Progress saving
	function scheduleSaveProgress() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		saveTimeout = setTimeout(saveProgress, 2000);
	}

	async function saveProgress() {
		try {
			await fetch(`/api/ebooks/${bookId}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: `page:${currentPage}`,
					percentage: ((currentPage + 1) / totalPages) * 100,
					currentPage,
					totalPages
				})
			});
		} catch (err) {
			console.error('Error saving progress:', err);
		}
	}

	// Save progress using sendBeacon (more reliable for page unload)
	function saveProgressBeacon() {
		if (totalPages === 0) return;

		const progressData = JSON.stringify({
			location: `page:${currentPage}`,
			percentage: ((currentPage + 1) / totalPages) * 100,
			currentPage,
			totalPages
		});

		if (navigator.sendBeacon) {
			navigator.sendBeacon(
				`/api/ebooks/${bookId}/progress`,
				new Blob([progressData], { type: 'application/json' })
			);
		}
	}

	// Handle visibility change (mobile Safari and tab switching)
	function handleVisibilityChange() {
		if (document.visibilityState === 'hidden' && totalPages > 0) {
			saveProgressBeacon();
		}
	}

	// Handle page hide (more reliable on iOS Safari)
	function handlePageHide() {
		if (totalPages > 0) {
			saveProgressBeacon();
		}
	}

	// Image load handler
	function handleImageLoad() {
		imageLoading = false;
	}

	// Effects
	$effect(() => {
		if (theme || displayMode || fitMode) {
			saveSettings();
		}
	});

	// Start a reading session
	async function startReadingSession() {
		try {
			const res = await fetch('/api/reading-sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookId,
					startProgress: initialProgress?.percentage || 0
				})
			});
			const result = await res.json();
			sessionId = result.sessionId;
		} catch (err) {
			console.error('Failed to start reading session:', err);
		}
	}

	// End a reading session
	async function endReadingSession() {
		if (!sessionId) return;

		try {
			await fetch(`/api/reading-sessions/${sessionId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					endProgress: totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0
				})
			});
		} catch (err) {
			console.error('Failed to end reading session:', err);
		}
	}

	onMount(() => {
		loadSettings();
		initReader();
		startReadingSession();
		document.addEventListener('keyup', handleKeyboard);

		// Save progress when page is hidden (mobile Safari, tab switching)
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Save progress on page hide (iOS Safari, page navigation)
		window.addEventListener('pagehide', handlePageHide);

		return () => {
			document.removeEventListener('keyup', handleKeyboard);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pagehide', handlePageHide);
		};
	});

	onDestroy(() => {
		endReadingSession();
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		// Use beacon for reliable save on unload
		saveProgressBeacon();
	});
</script>

<div
	class="reader-wrapper"
	style="--reader-bg: {colors.bg}; --reader-text: {colors.text}; --reader-ui: {colors.ui}; --reader-border: {colors.border}"
>
	<!-- Loading overlay -->
	{#if loading}
		<div class="loading-overlay">
			<Loader2 class="w-12 h-12 animate-spin text-blue-600 mb-4" />
			<p>Loading comic...</p>
		</div>
	{/if}

	<!-- Error overlay -->
	{#if errorMessage}
		<div class="loading-overlay">
			<div class="text-center">
				<div class="text-6xl mb-4">📚</div>
				<h2 class="text-xl font-semibold mb-2">Cannot Read Comic</h2>
				<p class="text-gray-500 mb-6">{errorMessage}</p>
				<a href="/books/{bookId}" class="btn btn-primary">Back to Book</a>
			</div>
		</div>
	{/if}

	<!-- Top toolbar -->
	<div class="reader-toolbar" class:hidden={isFullscreen}>
		<div class="flex items-center gap-2">
			<a href="/books/{bookId}" class="btn btn-icon" title="Back to book">
				<ArrowLeft class="w-5 h-5" />
			</a>
		</div>

		<span class="book-title">{bookTitle}</span>

		<div class="flex items-center gap-2">
			<button class="btn btn-icon" title="Zoom out" onclick={zoomOut}>
				<ZoomOut class="w-5 h-5" />
			</button>
			<span class="zoom-level">{Math.round(scale * 100)}%</span>
			<button class="btn btn-icon" title="Zoom in" onclick={zoomIn}>
				<ZoomIn class="w-5 h-5" />
			</button>
			<button
				class="btn btn-icon"
				title={displayMode === 'single' ? 'Double page mode' : 'Single page mode'}
				onclick={toggleDisplayMode}
			>
				{#if displayMode === 'single'}
					<Square class="w-5 h-5" />
				{:else}
					<Columns class="w-5 h-5" />
				{/if}
			</button>
			<button
				class="btn btn-icon"
				title="Settings"
				onclick={() => {
					settingsOpen = !settingsOpen;
				}}
			>
				<Settings class="w-5 h-5" />
			</button>
			<button class="btn btn-icon" title="Toggle fullscreen" onclick={toggleFullscreen}>
				{#if isFullscreen}
					<Minimize2 class="w-5 h-5" />
				{:else}
					<Maximize2 class="w-5 h-5" />
				{/if}
			</button>
		</div>
	</div>

	<!-- Settings panel -->
	<div class="settings-panel" class:open={settingsOpen}>
		<div class="settings-header">
			<h3 class="font-semibold">Settings</h3>
			<button class="btn btn-icon" onclick={() => (settingsOpen = false)}>
				<X class="w-4 h-4" />
			</button>
		</div>

		<div class="settings-section">
			<h4 class="settings-label">Background</h4>
			<div class="theme-buttons">
				<button
					class="theme-btn light"
					class:active={theme === 'light'}
					onclick={() => (theme = 'light')}
				>
					Light
				</button>
				<button
					class="theme-btn dark"
					class:active={theme === 'dark'}
					onclick={() => (theme = 'dark')}
				>
					Dark
				</button>
			</div>
		</div>

		<div class="settings-section">
			<h4 class="settings-label">Page Mode</h4>
			<div class="theme-buttons">
				<button
					class="theme-btn"
					class:active={displayMode === 'single'}
					onclick={() => {
						displayMode = 'single';
						loadPage(currentPage);
					}}
				>
					Single
				</button>
				<button
					class="theme-btn"
					class:active={displayMode === 'double'}
					onclick={() => {
						displayMode = 'double';
						loadPage(currentPage);
					}}
				>
					Double
				</button>
			</div>
		</div>

		<div class="settings-section">
			<h4 class="settings-label">Fit Mode</h4>
			<div class="theme-buttons">
				<button
					class="theme-btn"
					class:active={fitMode === 'width'}
					onclick={() => (fitMode = 'width')}
				>
					Width
				</button>
				<button
					class="theme-btn"
					class:active={fitMode === 'height'}
					onclick={() => (fitMode = 'height')}
				>
					Height
				</button>
				<button
					class="theme-btn"
					class:active={fitMode === 'both'}
					onclick={() => (fitMode = 'both')}
				>
					Both
				</button>
			</div>
		</div>

		<div class="settings-section">
			<h4 class="settings-label">Zoom: {Math.round(scale * 100)}%</h4>
			<input type="range" min="50" max="300" step="25" bind:value={scale} class="w-full" />
		</div>
	</div>

	<!-- Main reader area -->
	<div
		class="reader-container"
		class:fullscreen={isFullscreen}
		class:double-page={displayMode === 'double'}
		bind:this={imageContainerEl}
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
	>
		{#if imageLoading}
			<div class="image-loading">
				<Loader2 class="w-8 h-8 animate-spin" />
			</div>
		{/if}

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="image-wrapper"
			class:fit-width={fitMode === 'width'}
			class:fit-height={fitMode === 'height'}
			class:fit-both={fitMode === 'both'}
			style="transform: scale({scale})"
			onclick={handleImageClick}
		>
			{#if currentImageUrl}
				<img src={currentImageUrl} alt="Page {currentPage + 1}" class="comic-page" onload={handleImageLoad} />
			{/if}
			{#if displayMode === 'double' && nextImageUrl}
				<img src={nextImageUrl} alt="Page {currentPage + 2}" class="comic-page" />
			{/if}
		</div>
	</div>

	<!-- Navigation arrows -->
	<button class="nav-arrow prev" onclick={prevPage} title="Previous page" disabled={currentPage <= 0}>
		<ChevronLeft class="w-8 h-8" />
	</button>
	<button
		class="nav-arrow next"
		onclick={nextPage}
		title="Next page"
		disabled={currentPage >= totalPages - 1}
	>
		<ChevronRight class="w-8 h-8" />
	</button>

	<!-- Bottom status bar -->
	<div class="reader-status" class:hidden={isFullscreen}>
		<div class="page-nav">
			<input
				type="number"
				class="page-input"
				bind:value={pageInputValue}
				onchange={handlePageInput}
				min="1"
				max={totalPages}
			/>
			<span class="page-total">of {totalPages}</span>
		</div>
		<div class="progress-container">
			<div class="progress-bar">
				<div class="progress-fill" style="width: {((currentPage + 1) / totalPages) * 100}%"></div>
			</div>
		</div>
		<span class="progress-text">{Math.round(((currentPage + 1) / totalPages) * 100)}%</span>
	</div>
</div>

<style>
	.reader-wrapper {
		position: fixed;
		inset: 0;
		background: var(--reader-bg);
		color: var(--reader-text);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.loading-overlay {
		position: fixed;
		inset: 0;
		background: var(--reader-bg);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	/* Toolbar */
	.reader-toolbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 50px;
		background: var(--reader-ui);
		border-bottom: 1px solid var(--reader-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1rem;
		z-index: 1000;
		transition: transform 0.3s ease;
	}

	.reader-toolbar.hidden {
		transform: translateY(-100%);
	}

	.book-title {
		font-weight: 600;
		font-size: 1rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 40%;
		text-align: center;
	}

	.zoom-level {
		font-size: 0.85rem;
		min-width: 45px;
		text-align: center;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		border: 1px solid var(--reader-border);
		border-radius: 0.375rem;
		background: var(--reader-ui);
		color: var(--reader-text);
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:hover {
		background: var(--reader-border);
	}

	.btn-icon {
		padding: 0.5rem;
	}

	.btn-primary {
		background: #2563eb;
		border-color: #2563eb;
		color: white;
	}

	/* Settings Panel */
	.settings-panel {
		position: fixed;
		top: 50px;
		right: 0;
		bottom: 40px;
		width: 280px;
		background: var(--reader-ui);
		border-left: 1px solid var(--reader-border);
		transform: translateX(100%);
		transition: transform 0.3s ease;
		z-index: 500;
		overflow-y: auto;
		padding: 1rem;
	}

	.settings-panel.open {
		transform: translateX(0);
	}

	.settings-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--reader-border);
	}

	.settings-section {
		margin-bottom: 1.5rem;
	}

	.settings-label {
		font-size: 0.85rem;
		text-transform: uppercase;
		opacity: 0.7;
		margin-bottom: 0.75rem;
	}

	.theme-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.theme-btn {
		flex: 1;
		padding: 0.5rem;
		border: 2px solid var(--reader-border);
		border-radius: 0.5rem;
		cursor: pointer;
		text-align: center;
		font-size: 0.85rem;
		transition: all 0.2s;
		background: var(--reader-ui);
		color: var(--reader-text);
	}

	.theme-btn:hover {
		border-color: #2563eb;
	}

	.theme-btn.active {
		border-color: #2563eb;
		background: rgba(37, 99, 235, 0.1);
	}

	.theme-btn.light {
		background: #fff;
		color: #1a1a1a;
	}

	.theme-btn.dark {
		background: #1a1a1a;
		color: #fff;
	}

	/* Reader container */
	.reader-container {
		position: fixed;
		top: 50px;
		bottom: 40px;
		left: 0;
		right: 0;
		background: var(--reader-bg);
		overflow: auto;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.reader-container.fullscreen {
		top: 0;
		bottom: 0;
	}

	.image-loading {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.image-wrapper {
		display: flex;
		gap: 4px;
		transform-origin: center center;
		transition: transform 0.2s ease;
		cursor: pointer;
	}

	.comic-page {
		max-height: 100%;
		object-fit: contain;
	}

	.image-wrapper.fit-width .comic-page {
		width: 100%;
		max-width: 100%;
		height: auto;
	}

	.image-wrapper.fit-height .comic-page {
		height: calc(100vh - 90px);
		width: auto;
	}

	.image-wrapper.fit-both .comic-page {
		max-width: 100%;
		max-height: calc(100vh - 90px);
	}

	.double-page .image-wrapper.fit-width .comic-page {
		max-width: 50%;
	}

	/* Navigation arrows */
	.nav-arrow {
		position: fixed;
		top: 50%;
		transform: translateY(-50%);
		width: 60px;
		height: 100px;
		background: transparent;
		border: none;
		color: var(--reader-text);
		opacity: 0.3;
		cursor: pointer;
		z-index: 100;
		transition: opacity 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-arrow:hover:not(:disabled) {
		opacity: 0.8;
	}

	.nav-arrow:disabled {
		opacity: 0.1;
		cursor: not-allowed;
	}

	.nav-arrow.prev {
		left: 0;
	}

	.nav-arrow.next {
		right: 0;
	}

	/* Status bar */
	.reader-status {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: 40px;
		background: var(--reader-ui);
		border-top: 1px solid var(--reader-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1rem;
		font-size: 0.85rem;
		z-index: 1000;
		transition: transform 0.3s ease;
	}

	.reader-status.hidden {
		transform: translateY(100%);
	}

	.page-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-input {
		width: 50px;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--reader-border);
		border-radius: 0.25rem;
		background: var(--reader-bg);
		color: var(--reader-text);
		text-align: center;
	}

	.page-total {
		opacity: 0.7;
	}

	.progress-container {
		flex: 1;
		max-width: 300px;
		margin: 0 1rem;
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background: var(--reader-border);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #2563eb;
		transition: width 0.3s ease;
	}

	.progress-text {
		flex-shrink: 0;
		min-width: 40px;
		text-align: right;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.book-title {
			max-width: 30%;
			font-size: 0.9rem;
		}

		.nav-arrow {
			width: 40px;
		}

		.settings-panel {
			width: 100%;
		}

		.zoom-level {
			display: none;
		}
	}

	/* Hide nav arrows on touch devices */
	@media (pointer: coarse) {
		.nav-arrow {
			display: none;
		}
	}
</style>
