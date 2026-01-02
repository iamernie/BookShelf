<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		List,
		Settings,
		Maximize2,
		Minimize2,
		ChevronLeft,
		ChevronRight,
		X,
		Loader2
	} from 'lucide-svelte';
	import PdfReader from '$lib/components/reader/PdfReader.svelte';
	import CbzReader from '$lib/components/reader/CbzReader.svelte';

	interface PageData {
		book: {
			id: number;
			title: string;
			coverImageUrl: string | null;
			ebookPath: string | null;
			ebookFormat: string | null;
		};
		authors: { id: number; name: string; role: string | null; isPrimary: boolean | null }[];
		series: { id: number; title: string; bookNum: number | null; isPrimary: boolean | null }[];
		progress: {
			location: string;
			percentage: number;
			chapter?: string;
			currentPage?: number;
			totalPages?: number;
		} | null;
		ebookUrl: string;
	}

	let { data }: { data: PageData } = $props();

	// Determine which reader to use
	const format = data.book.ebookFormat?.toLowerCase();

	// State
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let book: any = $state(null);
	let rendition: any = $state(null);
	let currentLocation: any = $state(null);
	let isFullscreen = $state(false);
	let tocOpen = $state(false);
	let settingsOpen = $state(false);
	let toc = $state<any[]>([]);
	let chapterTitle = $state('Loading...');
	let progressPercent = $state(0);

	// Reading session tracking
	let sessionId = $state<number | null>(null);

	// Settings
	let theme = $state<'light' | 'sepia' | 'dark'>('light');
	let fontSize = $state(100);
	let lineHeight = $state(1.5);

	let readerViewEl: HTMLDivElement;
	let saveTimeout: ReturnType<typeof setTimeout>;

	// Load settings from localStorage
	function loadSettings() {
		if (typeof window !== 'undefined') {
			theme = (localStorage.getItem('readerTheme') as typeof theme) || 'light';
			fontSize = parseInt(localStorage.getItem('readerFontSize') || '100');
			lineHeight = parseFloat(localStorage.getItem('readerLineHeight') || '1.5');
		}
	}

	// Save settings to localStorage
	function saveSettings() {
		if (typeof window !== 'undefined') {
			localStorage.setItem('readerTheme', theme);
			localStorage.setItem('readerFontSize', fontSize.toString());
			localStorage.setItem('readerLineHeight', lineHeight.toString());
		}
	}

	// Apply theme to rendition
	function applyTheme() {
		if (!rendition) return;

		const themes = {
			light: { body: { background: '#ffffff', color: '#1a1a1a' } },
			dark: { body: { background: '#1a1a1a', color: '#e9ecef' } },
			sepia: { body: { background: '#f4ecd8', color: '#5b4636' } }
		};

		rendition.themes.default(themes[theme]);
		rendition.themes.fontSize(`${fontSize}%`);
		saveSettings();
	}

	// Initialize EPUB reader
	async function initReader() {
		// PDF and CBZ are handled by their own components
		if (format === 'pdf' || format === 'cbz') {
			loading = false;
			return;
		}

		if (format !== 'epub') {
			errorMessage = `${data.book.ebookFormat?.toUpperCase()} reader is not yet supported. Only EPUB, PDF, and CBZ files can be read.`;
			loading = false;
			return;
		}

		// Set a timeout for loading - if it takes too long, show error
		const loadTimeout = setTimeout(() => {
			if (loading) {
				console.error('Reader load timeout');
				errorMessage = 'The ebook is taking too long to load. Please try refreshing the page.';
				loading = false;
			}
		}, 30000); // 30 second timeout

		try {
			// Import JSZip first (required by epub.js)
			const JSZip = (await import('jszip')).default;
			// Make it globally available for epub.js
			if (typeof window !== 'undefined') {
				(window as any).JSZip = JSZip;
			}

			// Then import epub.js
			const ePub = (await import('epubjs')).default;

			book = ePub(data.ebookUrl);

			rendition = book.renderTo(readerViewEl, {
				width: '100%',
				height: '100%',
				spread: 'auto',
				flow: 'paginated'
			});

			// Apply settings
			loadSettings();
			applyTheme();

			// Wait for book to be ready
			await book.ready;

			clearTimeout(loadTimeout);
			loading = false;

			// Load table of contents
			const nav = await book.loaded.navigation;
			toc = nav.toc || [];

			// Set initial chapter title from saved progress or default
			if (data.progress?.chapter) {
				chapterTitle = data.progress.chapter;
			} else {
				chapterTitle = 'Reading...';
			}

			// Display at saved location or start
			if (data.progress?.location) {
				await rendition.display(data.progress.location);
			} else {
				await rendition.display();
			}

			// Track location changes
			rendition.on('relocated', (location: any) => {
				currentLocation = location;
				updateProgress(location);
				scheduleSaveProgress();
			});

			// Keyboard navigation inside epub
			rendition.on('keyup', handleKeyboard);

			// Handle click/tap inside epub iframe for navigation
			// This works better than touch events for mobile compatibility
			rendition.on('click', (e: MouseEvent) => {
				// Get the position relative to the viewport
				const screenWidth = window.innerWidth;
				const clickX = e.clientX || (e as any).screenX;

				// Tap in left 20% = prev, tap in right 20% = next
				if (clickX < screenWidth * 0.2) {
					prevPage();
				} else if (clickX > screenWidth * 0.8) {
					nextPage();
				}
				// Middle area - could toggle UI visibility
			});

			// Handle display errors
			rendition.on('displayError', (err: any) => {
				console.error('Display error:', err);
				errorMessage = 'Error displaying page. The ebook may be malformed.';
			});
		} catch (err) {
			clearTimeout(loadTimeout);
			console.error('Error initializing reader:', err);
			errorMessage = 'Failed to load ebook. The file may be corrupted.';
			loading = false;
		}
	}

	// Update progress display
	function updateProgress(location: any) {
		if (!location) return;

		progressPercent = Math.round((location.start.percentage || 0) * 100);

		// Try to get chapter title from the current location
		try {
			// First, try to get it from the location itself if available
			if (location.start?.index !== undefined && toc.length > 0) {
				// Find the chapter that contains this location
				const currentHref = location.start.href;
				if (currentHref) {
					const foundChapter = toc.find((ch: any) =>
						currentHref.includes(ch.href) || ch.href?.includes(currentHref.split('#')[0])
					);
					if (foundChapter) {
						chapterTitle = foundChapter.label || 'Reading...';
						return;
					}
				}
			}

			// Fallback: try book.navigation.get
			if (book?.navigation && location.start?.href) {
				book.navigation.get(location.start.href).then((chapter: any) => {
					if (chapter?.label) {
						chapterTitle = chapter.label;
					} else {
						chapterTitle = 'Reading...';
					}
				}).catch(() => {
					chapterTitle = 'Reading...';
				});
			} else {
				// No navigation available, just show generic text
				chapterTitle = 'Reading...';
			}
		} catch (err) {
			console.warn('[Reader] Error updating chapter title:', err);
			chapterTitle = 'Reading...';
		}
	}

	// Schedule save progress (debounced)
	function scheduleSaveProgress() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		saveTimeout = setTimeout(saveProgress, 2000);
	}

	// Save progress to server
	async function saveProgress() {
		if (!currentLocation) return;

		try {
			await fetch(`/api/ebooks/${data.book.id}/progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: currentLocation.start.cfi,
					percentage: currentLocation.start.percentage * 100,
					chapter: chapterTitle
				})
			});
		} catch (err) {
			console.error('Error saving progress:', err);
		}
	}

	// Save progress using sendBeacon (more reliable for page unload)
	function saveProgressBeacon() {
		if (!currentLocation) return;

		const progressData = JSON.stringify({
			location: currentLocation.start.cfi,
			percentage: currentLocation.start.percentage * 100,
			chapter: chapterTitle
		});

		// sendBeacon is designed to survive page navigation/close
		if (navigator.sendBeacon) {
			navigator.sendBeacon(
				`/api/ebooks/${data.book.id}/progress`,
				new Blob([progressData], { type: 'application/json' })
			);
		}
	}

	// Handle visibility change (mobile Safari and tab switching)
	function handleVisibilityChange() {
		if (document.visibilityState === 'hidden' && currentLocation) {
			// Page is being hidden (user switched apps, tabs, or minimized)
			// Use sendBeacon for reliable delivery
			saveProgressBeacon();
		}
	}

	// Handle page hide (more reliable on iOS Safari)
	function handlePageHide() {
		if (currentLocation) {
			saveProgressBeacon();
		}
	}

	// Navigation
	async function prevPage() {
		if (!rendition) {
			console.warn('[Reader] prevPage called but no rendition');
			return;
		}
		try {
			await rendition.prev();
		} catch (err) {
			console.error('[Reader] Error navigating to previous page:', err);
		}
	}

	async function nextPage() {
		if (!rendition) {
			console.warn('[Reader] nextPage called but no rendition');
			return;
		}
		try {
			await rendition.next();
		} catch (err) {
			console.error('[Reader] Error navigating to next page:', err);
		}
	}

	function goToChapter(href: string) {
		rendition?.display(href);
		tocOpen = false;
	}

	// Keyboard handler
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
			case 'Escape':
				tocOpen = false;
				settingsOpen = false;
				break;
		}
	}

	// Toggle fullscreen
	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
		// Resize rendition after layout change
		setTimeout(() => rendition?.resize(), 100);
	}

	// Jump to percentage
	function jumpToPercentage(e: MouseEvent) {
		if (!book) return;
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const percentage = (e.clientX - rect.left) / rect.width;

		book.locations.generate(1024).then(() => {
			const cfi = book.locations.cfiFromPercentage(percentage);
			rendition.display(cfi);
		});
	}

	// Touch handling for navigation
	let touchStartX = 0;
	let touchStartY = 0;
	let touchStartTime = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
		touchStartY = e.changedTouches[0].screenY;
		touchStartTime = Date.now();
	}

	function handleTouchEnd(e: TouchEvent) {
		const touchEndX = e.changedTouches[0].screenX;
		const touchEndY = e.changedTouches[0].screenY;
		const touchDuration = Date.now() - touchStartTime;
		const diffX = touchStartX - touchEndX;
		const diffY = touchStartY - touchEndY;

		// Swipe detection (quick horizontal movement)
		if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) && touchDuration < 500) {
			if (diffX > 0) {
				nextPage();
			} else {
				prevPage();
			}
			return;
		}

		// Tap detection - tap on left/right edge to navigate
		if (touchDuration < 300 && Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
			const screenWidth = window.innerWidth;
			const tapX = touchEndX;

			// Tap in left 25% = prev, tap in right 25% = next
			if (tapX < screenWidth * 0.25) {
				prevPage();
			} else if (tapX > screenWidth * 0.75) {
				nextPage();
			}
			// Tap in middle 50% - do nothing (could toggle UI)
		}
	}

	// Effect for theme changes
	$effect(() => {
		if (rendition && theme) {
			applyTheme();
		}
	});

	$effect(() => {
		if (rendition && fontSize) {
			rendition.themes.fontSize(`${fontSize}%`);
			saveSettings();
		}
	});

	// Start a reading session
	async function startReadingSession() {
		// Only start session for EPUB (PDF/CBZ have their own tracking)
		if (format !== 'epub') return;

		try {
			const res = await fetch('/api/reading-sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookId: data.book.id,
					startProgress: data.progress?.percentage || 0
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
					endProgress: progressPercent
				})
			});
		} catch (err) {
			console.error('Failed to end reading session:', err);
		}
	}

	onMount(() => {
		initReader();
		startReadingSession();

		// Global keyboard handler
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
		// End reading session
		endReadingSession();
		// Save progress before leaving using beacon for reliability
		if (currentLocation) {
			saveProgressBeacon();
		}
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		// Clean up epub.js
		if (book) {
			book.destroy();
		}
	});

	// Theme background colors
	const themeColors = {
		light: { bg: '#ffffff', text: '#1a1a1a', ui: '#f8f9fa', border: '#dee2e6' },
		sepia: { bg: '#f4ecd8', text: '#5b4636', ui: '#e8dcc8', border: '#c9b99a' },
		dark: { bg: '#1a1a1a', text: '#e9ecef', ui: '#212529', border: '#495057' }
	};

	let colors = $derived(themeColors[theme]);
</script>

<svelte:head>
	<title>Reading: {data.book.title}</title>
</svelte:head>

<!-- Use dedicated readers for PDF and CBZ -->
{#if format === 'pdf'}
	<PdfReader
		bookId={data.book.id}
		bookTitle={data.book.title}
		ebookUrl={data.ebookUrl}
		initialProgress={data.progress}
	/>
{:else if format === 'cbz'}
	<CbzReader
		bookId={data.book.id}
		bookTitle={data.book.title}
		ebookPath={data.book.ebookPath || ''}
		initialProgress={data.progress}
	/>
{:else}
<!-- EPUB Reader -->
<div
	class="reader-wrapper"
	style="--reader-bg: {colors.bg}; --reader-text: {colors.text}; --reader-ui: {colors.ui}; --reader-border: {colors.border}"
>
	<!-- Loading overlay -->
	{#if loading}
		<div class="loading-overlay">
			<Loader2 class="w-12 h-12 animate-spin text-blue-600 mb-4" />
			<p>Loading book...</p>
		</div>
	{/if}

	<!-- Error overlay -->
	{#if errorMessage}
		<div class="loading-overlay">
			<div class="text-center">
				<div class="text-6xl mb-4">📕</div>
				<h2 class="text-xl font-semibold mb-2">Cannot Read Book</h2>
				<p class="text-gray-500 mb-6">{errorMessage}</p>
				<a href="/books/{data.book.id}" class="btn btn-primary">Back to Book</a>
			</div>
		</div>
	{/if}

	<!-- Top toolbar -->
	<div class="reader-toolbar" class:hidden={isFullscreen}>
		<div class="flex items-center gap-2">
			<button type="button" class="btn btn-icon" title="Back" onclick={() => history.back()}>
				<ArrowLeft class="w-5 h-5" />
			</button>
			<button class="btn btn-icon" title="Table of Contents" onclick={() => { tocOpen = !tocOpen; settingsOpen = false; }}>
				<List class="w-5 h-5" />
			</button>
		</div>

		<span class="book-title">{data.book.title}</span>

		<div class="flex items-center gap-2">
			<button class="btn btn-icon" title="Settings" onclick={() => { settingsOpen = !settingsOpen; tocOpen = false; }}>
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

	<!-- Table of Contents sidebar -->
	<div class="toc-sidebar" class:open={tocOpen}>
		<div class="toc-header">
			<h3 class="font-semibold">Contents</h3>
			<button class="btn btn-icon" onclick={() => tocOpen = false}>
				<X class="w-4 h-4" />
			</button>
		</div>
		<ul class="toc-list">
			{#each toc as chapter}
				<li>
					<button class="toc-item" onclick={() => goToChapter(chapter.href)}>
						{chapter.label}
					</button>
					{#if chapter.subitems}
						{#each chapter.subitems as sub}
							<button class="toc-item nested" onclick={() => goToChapter(sub.href)}>
								{sub.label}
							</button>
						{/each}
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<!-- Settings panel -->
	<div class="settings-panel" class:open={settingsOpen}>
		<div class="settings-section">
			<h4 class="settings-label">Theme</h4>
			<div class="theme-buttons">
				<button
					class="theme-btn light"
					class:active={theme === 'light'}
					onclick={() => theme = 'light'}
				>
					Light
				</button>
				<button
					class="theme-btn sepia"
					class:active={theme === 'sepia'}
					onclick={() => theme = 'sepia'}
				>
					Sepia
				</button>
				<button
					class="theme-btn dark"
					class:active={theme === 'dark'}
					onclick={() => theme = 'dark'}
				>
					Dark
				</button>
			</div>
		</div>

		<div class="settings-section">
			<h4 class="settings-label">Font Size: {fontSize}%</h4>
			<input
				type="range"
				min="80"
				max="150"
				step="10"
				bind:value={fontSize}
				class="w-full"
			/>
		</div>

		<div class="settings-section">
			<h4 class="settings-label">Line Spacing: {lineHeight}</h4>
			<input
				type="range"
				min="1"
				max="2"
				step="0.1"
				bind:value={lineHeight}
				class="w-full"
			/>
		</div>

		<button class="btn btn-secondary w-full mt-4" onclick={() => settingsOpen = false}>
			Close Settings
		</button>
	</div>

	<!-- Main reader area -->
	<div
		class="reader-container"
		class:fullscreen={isFullscreen}
	>
		<div bind:this={readerViewEl} class="reader-view"></div>

		<!-- Mobile touch zones (overlay on top of iframe for navigation) -->
		<div class="touch-zones">
			<button
				type="button"
				class="touch-zone touch-zone-left"
				onclick={prevPage}
				ontouchend={(e) => { e.preventDefault(); prevPage(); }}
				aria-label="Previous page"
			></button>
			<div class="touch-zone touch-zone-center"></div>
			<button
				type="button"
				class="touch-zone touch-zone-right"
				onclick={nextPage}
				ontouchend={(e) => { e.preventDefault(); nextPage(); }}
				aria-label="Next page"
			></button>
		</div>
	</div>

	<!-- Navigation arrows -->
	<button class="nav-arrow prev" onclick={prevPage} title="Previous page">
		<ChevronLeft class="w-8 h-8" />
	</button>
	<button class="nav-arrow next" onclick={nextPage} title="Next page">
		<ChevronRight class="w-8 h-8" />
	</button>

	<!-- Bottom status bar -->
	<div class="reader-status" class:hidden={isFullscreen}>
		<span class="chapter-title">{chapterTitle}</span>
		<div class="progress-container">
			<button class="progress-bar" onclick={jumpToPercentage}>
				<div class="progress-fill" style="width: {progressPercent}%"></div>
			</button>
		</div>
		<span class="progress-text">{progressPercent}%</span>
	</div>
</div>
{/if}

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

	.btn-secondary {
		background: var(--reader-border);
	}

	/* TOC Sidebar */
	.toc-sidebar {
		position: fixed;
		top: 50px;
		left: 0;
		bottom: 40px;
		width: 280px;
		background: var(--reader-ui);
		border-right: 1px solid var(--reader-border);
		transform: translateX(-100%);
		transition: transform 0.3s ease;
		z-index: 500;
		overflow-y: auto;
	}

	.toc-sidebar.open {
		transform: translateX(0);
	}

	.toc-header {
		padding: 1rem;
		border-bottom: 1px solid var(--reader-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.toc-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.toc-item {
		display: block;
		width: 100%;
		padding: 0.75rem 1rem;
		text-align: left;
		border: none;
		border-bottom: 1px solid var(--reader-border);
		background: transparent;
		color: var(--reader-text);
		cursor: pointer;
		transition: background 0.2s;
	}

	.toc-item:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.toc-item.nested {
		padding-left: 2rem;
		font-size: 0.9rem;
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

	.theme-btn.sepia {
		background: #f4ecd8;
		color: #5b4636;
	}

	/* Reader container */
	.reader-container {
		position: fixed;
		top: 50px;
		bottom: 40px;
		left: 0;
		right: 0;
		background: var(--reader-bg);
		overflow: hidden;
	}

	.reader-container.fullscreen {
		top: 0;
		bottom: 0;
	}

	.reader-view {
		width: 100%;
		height: 100%;
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

	.nav-arrow:hover {
		opacity: 0.8;
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

	.chapter-title {
		flex-shrink: 0;
		max-width: 30%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.progress-container {
		flex: 1;
		max-width: 300px;
		margin: 0 1rem;
	}

	.progress-bar {
		display: block;
		width: 100%;
		height: 6px;
		background: var(--reader-border);
		border-radius: 3px;
		overflow: hidden;
		cursor: pointer;
		border: none;
		padding: 0;
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

		.toc-sidebar,
		.settings-panel {
			width: 100%;
		}
	}

	/* Hide nav arrows on touch devices */
	@media (pointer: coarse) {
		.nav-arrow {
			display: none;
		}
	}

	/* Touch zones for mobile navigation */
	.touch-zones {
		display: none;
		position: absolute;
		inset: 0;
		z-index: 50;
		pointer-events: none;
	}

	.touch-zone {
		pointer-events: auto;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.touch-zone:focus {
		outline: none;
	}

	.touch-zone-left,
	.touch-zone-right {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 20%;
	}

	.touch-zone-left {
		left: 0;
	}

	.touch-zone-right {
		right: 0;
	}

	.touch-zone-center {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 20%;
		right: 20%;
		pointer-events: none;
	}

	/* Show touch zones only on touch devices */
	@media (pointer: coarse) {
		.touch-zones {
			display: block;
		}
	}
</style>
