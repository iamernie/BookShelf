<script lang="ts">
	import { Upload, Book, User, FileText, Check, Loader2, AlertCircle, X } from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	interface Props {
		onComplete?: (bookId: number) => void;
		onClose?: () => void;
		libraryType?: 'personal' | 'public';
	}

	let { onComplete, onClose, libraryType = 'public' }: Props = $props();

	// States
	type UploadStage = 'idle' | 'uploading' | 'preview' | 'importing' | 'done' | 'error';
	let stage = $state<UploadStage>('idle');
	let dragOver = $state(false);
	let error = $state<string | null>(null);

	// Queue item data
	let queueItem = $state<{
		id: number;
		filename: string;
		coverData: string | null;
		parsedMetadata: {
			title?: string;
			authors?: string[];
			description?: string;
			isbn?: string;
			publisher?: string;
			language?: string;
		} | null;
	} | null>(null);

	// Editable metadata
	let title = $state('');
	let authorName = $state('');
	let description = $state('');
	let genreId = $state<number | null>(null);

	// Options for dropdowns
	let genres = $state<Array<{ id: number; name: string }>>([]);

	// Load options on mount
	$effect(() => {
		loadOptions();
	});

	async function loadOptions() {
		try {
			const response = await fetch('/api/books/options');
			if (response.ok) {
				const data = await response.json();
				genres = data.genres || [];
			}
		} catch (e) {
			console.error('Failed to load options:', e);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFiles(files);
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			handleFiles(input.files);
		}
	}

	async function handleFiles(files: FileList) {
		const file = files[0];

		const validExtensions = ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.cbz', '.cbr'];
		const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

		if (!validExtensions.includes(ext)) {
			error = `Invalid file type: ${ext}. Supported formats: ${validExtensions.join(', ')}`;
			stage = 'error';
			return;
		}

		stage = 'uploading';
		error = null;

		try {
			const formData = new FormData();
			formData.append('files', file);

			const response = await fetch('/api/bookdrop/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || `Upload failed: ${response.status}`);
			}

			const uploadedItem = result.results?.[0];
			if (!uploadedItem?.success || !uploadedItem?.id) {
				// Show the specific file error if available
				const fileError = uploadedItem?.error || result.message || 'Failed to process file';
				throw new Error(fileError);
			}

			const itemResponse = await fetch(`/api/bookdrop/${uploadedItem.id}`);
			if (!itemResponse.ok) {
				throw new Error('Failed to fetch upload details');
			}

			queueItem = await itemResponse.json();

			if (queueItem) {
				title = queueItem.parsedMetadata?.title || queueItem.filename.replace(/\.[^.]+$/, '');
				authorName = queueItem.parsedMetadata?.authors?.[0] || '';
				description = queueItem.parsedMetadata?.description || '';
			}

			stage = 'preview';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Upload failed';
			stage = 'error';
		}
	}

	async function handleImport() {
		if (!queueItem) return;

		stage = 'importing';
		error = null;

		try {
			const response = await fetch(`/api/bookdrop/${queueItem.id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'import',
					title: title.trim() || queueItem.filename,
					authorName: authorName.trim() || null,
					genreId: genreId,
					libraryType
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Import failed');
			}

			stage = 'done';
			toasts.success(`"${title}" added to ${libraryType === 'public' ? 'public library' : 'your library'}!`);

			if (onComplete && result.bookId) {
				onComplete(result.bookId);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Import failed';
			stage = 'error';
		}
	}

	async function handleCancel() {
		if (queueItem && stage === 'preview') {
			try {
				await fetch(`/api/bookdrop/${queueItem.id}`, { method: 'DELETE' });
			} catch {
				// Ignore errors on cancel
			}
		}

		stage = 'idle';
		queueItem = null;
		title = '';
		authorName = '';
		description = '';
		genreId = null;
		error = null;
	}

	function reset() {
		stage = 'idle';
		queueItem = null;
		title = '';
		authorName = '';
		description = '';
		genreId = null;
		error = null;
	}
</script>

<div class="p-6">
	{#if stage === 'idle'}
		<!-- Drop Zone -->
		<div
			class="relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer"
			class:border-accent={dragOver}
			style="border-color: {dragOver ? 'var(--accent)' : 'var(--border-color)'}; background-color: {dragOver ? 'var(--bg-tertiary)' : 'var(--bg-secondary)'};"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			<Upload class="w-12 h-12 mb-4" style="color: var(--text-muted);" />
			<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
				Upload Ebook to {libraryType === 'public' ? 'Public Library' : 'Your Library'}
			</h3>
			<p class="text-sm mb-1" style="color: var(--text-muted);">
				Drag and drop an ebook file here, or click to browse
			</p>
			<p class="text-xs" style="color: var(--text-muted); opacity: 0.7;">
				Supported: EPUB, PDF, MOBI, AZW, AZW3, CBZ, CBR
			</p>
			<input
				type="file"
				accept=".epub,.pdf,.mobi,.azw,.azw3,.cbz,.cbr"
				onchange={handleFileInput}
				class="absolute inset-0 opacity-0 cursor-pointer"
			/>
		</div>

	{:else if stage === 'uploading'}
		<!-- Uploading State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<Loader2 class="w-10 h-10 mb-4 animate-spin" style="color: var(--accent);" />
			<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
				Uploading & Extracting Metadata...
			</h3>
			<p class="text-sm" style="color: var(--text-muted);">This may take a moment</p>
		</div>

	{:else if stage === 'preview' && queueItem}
		<!-- Preview & Edit -->
		<div class="space-y-6">
			<div class="text-center">
				<h3 class="text-xl font-semibold mb-1" style="color: var(--text-primary);">Review & Import</h3>
				<p class="text-sm" style="color: var(--text-muted);">Review the extracted metadata and make any changes before importing</p>
			</div>

			<div class="grid gap-6" style="grid-template-columns: 140px 1fr;">
				<!-- Cover Preview -->
				<div class="flex flex-col items-center">
					{#if queueItem.coverData}
						<img
							src={queueItem.coverData}
							alt="Cover"
							class="w-[140px] rounded-lg shadow-lg object-cover"
							style="max-height: 220px;"
						/>
					{:else}
						<div
							class="w-[140px] h-[200px] flex flex-col items-center justify-center gap-2 rounded-lg"
							style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-muted);"
						>
							<Book class="w-8 h-8" />
							<span class="text-xs">No cover</span>
						</div>
					{/if}
				</div>

				<!-- Metadata Form -->
				<div class="space-y-4">
					<div>
						<label class="label flex items-center gap-1.5">
							<Book class="w-4 h-4" />
							Title
						</label>
						<input
							type="text"
							class="input"
							bind:value={title}
							placeholder="Enter book title"
						/>
					</div>

					<div>
						<label class="label flex items-center gap-1.5">
							<User class="w-4 h-4" />
							Author
						</label>
						<input
							type="text"
							class="input"
							bind:value={authorName}
							placeholder="Enter author name"
						/>
					</div>

					<div>
						<label class="label flex items-center gap-1.5">
							<FileText class="w-4 h-4" />
							Genre
						</label>
						<select class="select" bind:value={genreId}>
							<option value={null}>-- Select Genre --</option>
							{#each genres as genre}
								<option value={genre.id}>{genre.name}</option>
							{/each}
						</select>
					</div>

					{#if description}
						<div>
							<label class="label">Description</label>
							<p class="text-sm leading-relaxed" style="color: var(--text-secondary);">
								{description.substring(0, 200)}{description.length > 200 ? '...' : ''}
							</p>
						</div>
					{/if}

					<div>
						<label class="label">File</label>
						<p class="text-sm font-mono break-all" style="color: var(--text-muted);">
							{queueItem.filename}
						</p>
					</div>

					<div class="p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
						<p class="text-sm" style="color: var(--text-secondary);">
							This ebook will be added to the <strong style="color: var(--text-primary);">{libraryType === 'public' ? 'Public Library' : 'your personal library'}</strong>
						</p>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-3 pt-4" style="border-top: 1px solid var(--border-color);">
				<button type="button" class="btn-secondary" onclick={handleCancel}>
					<X class="w-4 h-4" />
					Cancel
				</button>
				<button type="button" class="btn-accent" onclick={handleImport}>
					<Check class="w-4 h-4" />
					Import to Library
				</button>
			</div>
		</div>

	{:else if stage === 'importing'}
		<!-- Importing State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<Loader2 class="w-10 h-10 mb-4 animate-spin" style="color: var(--accent);" />
			<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">Importing Book...</h3>
			<p class="text-sm" style="color: var(--text-muted);">Adding to the library</p>
		</div>

	{:else if stage === 'done'}
		<!-- Success State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-12 h-12 rounded-full flex items-center justify-center mb-4" style="background-color: #22c55e;">
				<Check class="w-6 h-6 text-white" />
			</div>
			<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">Import Complete!</h3>
			<p class="text-sm mb-6" style="color: var(--text-muted);">
				"{title}" has been added to the {libraryType === 'public' ? 'public library' : 'your library'}
			</p>
			<div class="flex gap-3">
				<button type="button" class="btn-secondary" onclick={reset}>
					Upload Another
				</button>
				{#if onClose}
					<button type="button" class="btn-accent" onclick={onClose}>
						Done
					</button>
				{/if}
			</div>
		</div>

	{:else if stage === 'error'}
		<!-- Error State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-12 h-12 rounded-full flex items-center justify-center mb-4" style="background-color: #ef4444;">
				<AlertCircle class="w-6 h-6 text-white" />
			</div>
			<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">Upload Failed</h3>
			<p class="text-sm mb-6" style="color: var(--text-muted);">{error}</p>
			<button type="button" class="btn-secondary" onclick={reset}>
				Try Again
			</button>
		</div>
	{/if}
</div>

<style>
	/* Animate spin for loader */
	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* Mobile responsiveness for preview grid */
	@media (max-width: 480px) {
		div[style*="grid-template-columns: 140px"] {
			grid-template-columns: 1fr !important;
		}
	}
</style>
