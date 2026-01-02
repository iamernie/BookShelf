<script lang="ts">
	import { Download, FileJson, FileSpreadsheet, BookOpen, Check } from 'lucide-svelte';

	// Export options
	let format = $state<'csv' | 'json'>('csv');
	let goodreadsCompatible = $state(false);
	let includeAuthors = $state(true);
	let includeSeries = $state(true);
	let includeTags = $state(true);
	let includeGenres = $state(true);
	let includeFormats = $state(true);
	let includeNarrators = $state(true);
	let includeStatuses = $state(true);

	let isExporting = $state(false);
	let exportSuccess = $state(false);
	let exportError = $state('');
	let lastExportInfo = $state<{ filename: string; bookCount: number } | null>(null);

	async function handleExport() {
		isExporting = true;
		exportError = '';
		exportSuccess = false;

		try {
			const params = new URLSearchParams({
				format,
				goodreads: goodreadsCompatible.toString(),
				authors: includeAuthors.toString(),
				series: includeSeries.toString(),
				tags: includeTags.toString(),
				genres: includeGenres.toString(),
				formats: includeFormats.toString(),
				narrators: includeNarrators.toString(),
				statuses: includeStatuses.toString()
			});

			const response = await fetch(`/api/export?${params}`);

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Export failed');
			}

			// Get book count from header
			const bookCount = parseInt(response.headers.get('X-Book-Count') || '0');

			// Get filename from Content-Disposition header
			const disposition = response.headers.get('Content-Disposition') || '';
			const filenameMatch = disposition.match(/filename="([^"]+)"/);
			const filename = filenameMatch ? filenameMatch[1] : `export.${format}`;

			// Download the file
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			exportSuccess = true;
			lastExportInfo = { filename, bookCount };

			// Clear success after 5 seconds
			setTimeout(() => {
				exportSuccess = false;
			}, 5000);
		} catch (e) {
			exportError = e instanceof Error ? e.message : 'Export failed';
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Export Library - BookShelf</title>
</svelte:head>

<div class="max-w-2xl mx-auto p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary);">Export Library</h1>
		<p style="color: var(--text-secondary);">
			Download your book collection as a CSV or JSON file for backup or use in other applications.
		</p>
	</div>

	<!-- Format Selection -->
	<div class="rounded-lg p-6 mb-6" style="background: var(--bg-secondary); border: 1px solid var(--border-color);">
		<h2 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Export Format</h2>

		<div class="grid grid-cols-2 gap-4">
			<button
				type="button"
				onclick={() => { format = 'csv'; goodreadsCompatible = false; }}
				class="p-4 rounded-lg border-2 text-left transition-colors"
				style="background: var(--bg-primary); border-color: {format === 'csv' && !goodreadsCompatible ? 'var(--accent)' : 'var(--border-color)'};"
			>
				<div class="flex items-center gap-3 mb-2">
					<FileSpreadsheet class="w-6 h-6" style="color: var(--accent);" />
					<span class="font-medium" style="color: var(--text-primary);">CSV (Full)</span>
				</div>
				<p class="text-sm" style="color: var(--text-secondary);">
					Complete export with all BookShelf fields. Best for backups and re-importing.
				</p>
			</button>

			<button
				type="button"
				onclick={() => { format = 'csv'; goodreadsCompatible = true; }}
				class="p-4 rounded-lg border-2 text-left transition-colors"
				style="background: var(--bg-primary); border-color: {format === 'csv' && goodreadsCompatible ? 'var(--accent)' : 'var(--border-color)'};"
			>
				<div class="flex items-center gap-3 mb-2">
					<BookOpen class="w-6 h-6" style="color: var(--accent);" />
					<span class="font-medium" style="color: var(--text-primary);">Goodreads CSV</span>
				</div>
				<p class="text-sm" style="color: var(--text-secondary);">
					Compatible format for importing into Goodreads or similar apps.
				</p>
			</button>

			<button
				type="button"
				onclick={() => { format = 'json'; goodreadsCompatible = false; }}
				class="p-4 rounded-lg border-2 text-left transition-colors col-span-2"
				style="background: var(--bg-primary); border-color: {format === 'json' ? 'var(--accent)' : 'var(--border-color)'};"
			>
				<div class="flex items-center gap-3 mb-2">
					<FileJson class="w-6 h-6" style="color: var(--accent);" />
					<span class="font-medium" style="color: var(--text-primary);">JSON</span>
				</div>
				<p class="text-sm" style="color: var(--text-secondary);">
					Full structured export including all entities (authors, series, tags, etc.). Best for developers or complete backups.
				</p>
			</button>
		</div>
	</div>

	<!-- Include Options (only for non-Goodreads formats) -->
	{#if !goodreadsCompatible}
		<div class="rounded-lg p-6 mb-6" style="background: var(--bg-secondary); border: 1px solid var(--border-color);">
			<h2 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Include Data</h2>

			<div class="grid grid-cols-2 gap-3">
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={includeAuthors} class="rounded" />
					<span style="color: var(--text-primary);">Authors</span>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={includeSeries} class="rounded" />
					<span style="color: var(--text-primary);">Series</span>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={includeTags} class="rounded" />
					<span style="color: var(--text-primary);">Tags</span>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={includeGenres} class="rounded" />
					<span style="color: var(--text-primary);">Genres</span>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={includeFormats} class="rounded" />
					<span style="color: var(--text-primary);">Formats</span>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={includeNarrators} class="rounded" />
					<span style="color: var(--text-primary);">Narrators</span>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={includeStatuses} class="rounded" />
					<span style="color: var(--text-primary);">Statuses</span>
				</label>
			</div>
		</div>
	{/if}

	<!-- Export Button -->
	<div class="flex items-center gap-4">
		<button
			type="button"
			onclick={handleExport}
			disabled={isExporting}
			class="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
			style="background: var(--accent); color: white;"
		>
			{#if isExporting}
				<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
				Exporting...
			{:else}
				<Download class="w-5 h-5" />
				Export Library
			{/if}
		</button>

		{#if exportSuccess && lastExportInfo}
			<div class="flex items-center gap-2 text-green-600">
				<Check class="w-5 h-5" />
				<span>
					Exported {lastExportInfo.bookCount} books to {lastExportInfo.filename}
				</span>
			</div>
		{/if}
	</div>

	{#if exportError}
		<div class="mt-4 p-4 rounded-lg bg-red-500/10 text-red-500">
			{exportError}
		</div>
	{/if}

	<!-- Help Text -->
	<div class="mt-8 p-4 rounded-lg" style="background: var(--bg-tertiary);">
		<h3 class="font-medium mb-2" style="color: var(--text-primary);">Format Details</h3>
		<ul class="text-sm space-y-2" style="color: var(--text-secondary);">
			<li>
				<strong>CSV (Full):</strong> Contains all book fields in a spreadsheet-compatible format. Multiple authors/series are separated by semicolons.
			</li>
			<li>
				<strong>Goodreads CSV:</strong> Matches the Goodreads export format with columns like "Book Id", "Title", "Author", "My Rating", "Exclusive Shelf", etc.
			</li>
			<li>
				<strong>JSON:</strong> Structured data format with nested objects for relationships. Includes complete entity lists (authors, series, tags) for a full backup.
			</li>
		</ul>
	</div>
</div>
