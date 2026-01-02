<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Upload,
		FileText,
		Check,
		X,
		AlertCircle,
		RefreshCw,
		Trash2,
		Settings,
		FolderOpen,
		Play,
		Pause,
		Download,
		Edit,
		Eye
	} from 'lucide-svelte';

	let { data } = $props();

	// State
	let activeTab = $state<'pending' | 'imported' | 'failed' | 'skipped'>('pending');
	let showSettings = $state(false);
	let selectedIds = $state<Set<number>>(new Set());
	let uploading = $state(false);
	let editingItem = $state<number | null>(null);

	// Edit form state
	let editTitle = $state('');
	let editAuthor = $state('');
	let editStatusId = $state<number | null>(null);
	let editFormatId = $state<number | null>(null);
	let editGenreId = $state<number | null>(null);

	// Settings form
	let settingsForm = $state({
		folderPath: data.settings.folderPath || '',
		enabled: data.settings.enabled ?? true,
		autoImport: data.settings.autoImport ?? false,
		afterImport: data.settings.afterImport || 'move',
		processedFolder: data.settings.processedFolder || '',
		afterSkip: data.settings.afterSkip || 'keep',
		skippedFolder: data.settings.skippedFolder || '',
		defaultStatusId: data.settings.defaultStatusId,
		defaultFormatId: data.settings.defaultFormatId
	});

	// Computed
	let currentItems = $derived(
		activeTab === 'pending'
			? data.pendingItems
			: activeTab === 'imported'
				? data.importedItems
				: activeTab === 'failed'
					? data.failedItems
					: data.skippedItems
	);

	let allSelected = $derived(
		currentItems.length > 0 && currentItems.every((item) => selectedIds.has(item.id))
	);

	// File upload
	let uploadError = $state<string | null>(null);

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		uploading = true;
		uploadError = null;

		const formData = new FormData();
		for (const file of input.files) {
			formData.append('files', file);
		}

		try {
			const res = await fetch('/api/bookdrop/upload', {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				await invalidateAll();
			} else {
				const errorData = await res.json().catch(() => ({ message: res.statusText }));
				uploadError = errorData.message || `Upload failed: ${res.status}`;
			}
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	// Drag and drop
	let dragOver = $state(false);

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		const files = event.dataTransfer?.files;
		if (!files?.length) return;

		uploading = true;
		uploadError = null;

		const formData = new FormData();
		for (const file of files) {
			formData.append('files', file);
		}

		try {
			const res = await fetch('/api/bookdrop/upload', {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				await invalidateAll();
			} else {
				const errorData = await res.json().catch(() => ({ message: res.statusText }));
				uploadError = errorData.message || `Upload failed: ${res.status}`;
			}
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			uploading = false;
		}
	}

	// Actions
	async function importItem(id: number) {
		const res = await fetch(`/api/bookdrop/${id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'import',
				title: editingItem === id ? editTitle : undefined,
				authorName: editingItem === id ? editAuthor : undefined,
				statusId: editingItem === id ? editStatusId : undefined,
				formatId: editingItem === id ? editFormatId : undefined,
				genreId: editingItem === id ? editGenreId : undefined
			})
		});

		if (res.ok) {
			editingItem = null;
			await invalidateAll();
		}
	}

	async function skipItem(id: number) {
		const res = await fetch(`/api/bookdrop/${id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'skip' })
		});

		if (res.ok) {
			await invalidateAll();
		}
	}

	async function deleteItem(id: number) {
		if (!confirm('Delete this file from the queue?')) return;

		const res = await fetch(`/api/bookdrop/${id}`, {
			method: 'DELETE'
		});

		if (res.ok) {
			selectedIds.delete(id);
			await invalidateAll();
		}
	}

	async function retryItem(id: number) {
		const res = await fetch(`/api/bookdrop/${id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'retry' })
		});

		if (res.ok) {
			await invalidateAll();
		}
	}

	// Bulk actions
	async function bulkAction(action: 'import' | 'skip' | 'delete') {
		if (selectedIds.size === 0) return;

		if (action === 'delete' && !confirm(`Delete ${selectedIds.size} items?`)) return;

		const res = await fetch('/api/bookdrop/bulk', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action,
				ids: Array.from(selectedIds)
			})
		});

		if (res.ok) {
			selectedIds.clear();
			await invalidateAll();
		}
	}

	async function importAll() {
		if (!confirm('Import all pending items?')) return;

		const res = await fetch('/api/bookdrop/bulk', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'import_all' })
		});

		if (res.ok) {
			await invalidateAll();
		}
	}

	// Settings
	async function saveSettings() {
		const res = await fetch('/api/bookdrop/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(settingsForm)
		});

		if (res.ok) {
			showSettings = false;
			await invalidateAll();
		}
	}

	// Selection
	function toggleSelectAll() {
		if (allSelected) {
			selectedIds.clear();
		} else {
			for (const item of currentItems) {
				selectedIds.add(item.id);
			}
		}
		selectedIds = selectedIds; // Trigger reactivity
	}

	function toggleSelect(id: number) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
		selectedIds = selectedIds; // Trigger reactivity
	}

	// Edit mode
	function startEdit(item: (typeof currentItems)[0]) {
		editingItem = item.id;
		editTitle = item.parsedMetadata?.title || item.filename;
		editAuthor = item.parsedMetadata?.authors?.[0] || '';
		editStatusId = data.settings.defaultStatusId;
		editFormatId = data.settings.defaultFormatId;
		editGenreId = null;
	}

	function cancelEdit() {
		editingItem = null;
	}

	// Format file size
	function formatSize(bytes: number | null): string {
		if (!bytes) return '-';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<svelte:head>
	<title>BookDrop - BookShelf</title>
</svelte:head>

<div
	class="p-6 max-w-7xl mx-auto"
	ondragover={(e) => {
		e.preventDefault();
		dragOver = true;
	}}
	ondragleave={() => (dragOver = false)}
	ondrop={handleDrop}
>
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">BookDrop</h1>
			<p class="text-sm" style="color: var(--text-secondary);">
				Upload and manage ebook imports
			</p>
		</div>

		<div class="flex items-center gap-3">
			<!-- Watcher Status -->
			{#if data.watcherRunning}
				<span class="flex items-center gap-2 text-sm text-green-500">
					<Play class="w-4 h-4" />
					Watching folder
				</span>
			{/if}

			<!-- Settings Button -->
			<button class="btn-secondary" onclick={() => (showSettings = !showSettings)}>
				<Settings class="w-4 h-4" />
				Settings
			</button>

			<!-- Upload Button -->
			<label class="btn-accent cursor-pointer">
				<Upload class="w-4 h-4" />
				{uploading ? 'Uploading...' : 'Upload Files'}
				<input
					type="file"
					accept=".epub,.pdf,.mobi,.azw,.azw3,.cbz,.cbr"
					multiple
					class="hidden"
					onchange={handleFileUpload}
					disabled={uploading}
				/>
			</label>
		</div>
	</div>

	<!-- Drop Zone Overlay -->
	{#if dragOver}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			style="pointer-events: none;"
		>
			<div class="card p-12 text-center">
				<Upload class="w-16 h-16 mx-auto mb-4" style="color: var(--accent);" />
				<p class="text-xl font-semibold" style="color: var(--text-primary);">
					Drop ebook files here
				</p>
			</div>
		</div>
	{/if}

	<!-- Settings Panel -->
	{#if showSettings}
		<div class="card p-6 mb-6">
			<h2 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">
				BookDrop Settings
			</h2>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- Watch Folder -->
				<div>
					<label class="label">Watch Folder Path</label>
					<div class="flex gap-2">
						<input
							type="text"
							class="input flex-1"
							placeholder="/path/to/bookdrop"
							bind:value={settingsForm.folderPath}
						/>
						<button class="btn-secondary">
							<FolderOpen class="w-4 h-4" />
						</button>
					</div>
				</div>

				<!-- Enabled -->
				<div class="flex items-center gap-3">
					<input
						type="checkbox"
						id="enabled"
						bind:checked={settingsForm.enabled}
						class="w-4 h-4"
					/>
					<label for="enabled" class="label mb-0">Enable folder watching</label>
				</div>

				<!-- Auto Import -->
				<div class="flex items-center gap-3">
					<input
						type="checkbox"
						id="autoImport"
						bind:checked={settingsForm.autoImport}
						class="w-4 h-4"
					/>
					<label for="autoImport" class="label mb-0">
						Auto-import (skip preview)
					</label>
				</div>

				<!-- After Import -->
				<div>
					<label class="label">After Import</label>
					<select class="input" bind:value={settingsForm.afterImport}>
						<option value="keep">Keep original file</option>
						<option value="move">Move to processed folder</option>
						<option value="delete">Delete original file</option>
					</select>
				</div>

				{#if settingsForm.afterImport === 'move'}
					<div>
						<label class="label">Processed Folder</label>
						<input
							type="text"
							class="input"
							placeholder="/path/to/processed"
							bind:value={settingsForm.processedFolder}
						/>
					</div>
				{/if}

				<!-- Default Status -->
				<div>
					<label class="label">Default Status</label>
					<select class="input" bind:value={settingsForm.defaultStatusId}>
						<option value={null}>None</option>
						{#each data.statuses as status}
							<option value={status.id}>{status.name}</option>
						{/each}
					</select>
				</div>

				<!-- Default Format -->
				<div>
					<label class="label">Default Format</label>
					<select class="input" bind:value={settingsForm.defaultFormatId}>
						<option value={null}>Auto-detect</option>
						{#each data.formats as format}
							<option value={format.id}>{format.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex justify-end gap-3 mt-4">
				<button class="btn-secondary" onclick={() => (showSettings = false)}>Cancel</button>
				<button class="btn-accent" onclick={saveSettings}>Save Settings</button>
			</div>
		</div>
	{/if}

	<!-- Upload Error Message -->
	{#if uploadError}
		<div class="mb-4 p-4 rounded-lg flex items-center gap-3" style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);">
			<AlertCircle class="w-5 h-5 text-red-500 shrink-0" />
			<span class="text-red-500">{uploadError}</span>
			<button class="ml-auto text-red-400 hover:text-red-300" onclick={() => uploadError = null}>
				<X class="w-4 h-4" />
			</button>
		</div>
	{/if}

	<!-- Stats -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
		<button
			class="card p-4 text-center hover:ring-2 ring-blue-500/50 transition-all"
			class:ring-2={activeTab === 'pending'}
			onclick={() => (activeTab = 'pending')}
		>
			<div class="text-2xl font-bold" style="color: var(--text-primary);">
				{data.stats.pending}
			</div>
			<div class="text-sm" style="color: var(--text-secondary);">Pending</div>
		</button>

		<button
			class="card p-4 text-center hover:ring-2 ring-green-500/50 transition-all"
			class:ring-2={activeTab === 'imported'}
			onclick={() => (activeTab = 'imported')}
		>
			<div class="text-2xl font-bold text-green-500">{data.stats.imported}</div>
			<div class="text-sm" style="color: var(--text-secondary);">Imported</div>
		</button>

		<button
			class="card p-4 text-center hover:ring-2 ring-red-500/50 transition-all"
			class:ring-2={activeTab === 'failed'}
			onclick={() => (activeTab = 'failed')}
		>
			<div class="text-2xl font-bold text-red-500">{data.stats.failed}</div>
			<div class="text-sm" style="color: var(--text-secondary);">Failed</div>
		</button>

		<button
			class="card p-4 text-center hover:ring-2 ring-yellow-500/50 transition-all"
			class:ring-2={activeTab === 'skipped'}
			onclick={() => (activeTab = 'skipped')}
		>
			<div class="text-2xl font-bold text-yellow-500">{data.stats.skipped}</div>
			<div class="text-sm" style="color: var(--text-secondary);">Skipped</div>
		</button>

		<div class="card p-4 text-center">
			<div class="text-2xl font-bold" style="color: var(--text-primary);">
				{data.stats.pending +
					data.stats.imported +
					data.stats.failed +
					data.stats.skipped}
			</div>
			<div class="text-sm" style="color: var(--text-secondary);">Total</div>
		</div>
	</div>

	<!-- Bulk Actions -->
	{#if activeTab === 'pending' && data.pendingItems.length > 0}
		<div class="flex items-center gap-3 mb-4">
			<button class="btn-accent" onclick={importAll}>
				<Download class="w-4 h-4" />
				Import All
			</button>

			{#if selectedIds.size > 0}
				<button class="btn-secondary" onclick={() => bulkAction('import')}>
					Import Selected ({selectedIds.size})
				</button>
				<button class="btn-secondary" onclick={() => bulkAction('skip')}>
					Skip Selected
				</button>
				<button class="btn-secondary text-red-500" onclick={() => bulkAction('delete')}>
					Delete Selected
				</button>
			{/if}
		</div>
	{/if}

	<!-- Queue Table -->
	<div class="card overflow-hidden">
		<table class="w-full">
			<thead style="background-color: var(--bg-secondary);">
				<tr>
					{#if activeTab === 'pending'}
						<th class="p-3 text-left w-10">
							<input
								type="checkbox"
								checked={allSelected}
								onchange={toggleSelectAll}
								class="w-4 h-4"
							/>
						</th>
					{/if}
					<th class="p-3 text-left" style="color: var(--text-secondary);">Cover</th>
					<th class="p-3 text-left" style="color: var(--text-secondary);">Title</th>
					<th class="p-3 text-left" style="color: var(--text-secondary);">Author</th>
					<th class="p-3 text-left" style="color: var(--text-secondary);">Size</th>
					<th class="p-3 text-left" style="color: var(--text-secondary);">Source</th>
					<th class="p-3 text-right" style="color: var(--text-secondary);">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each currentItems as item (item.id)}
					<tr class="border-t" style="border-color: var(--border-color);">
						{#if activeTab === 'pending'}
							<td class="p-3">
								<input
									type="checkbox"
									checked={selectedIds.has(item.id)}
									onchange={() => toggleSelect(item.id)}
									class="w-4 h-4"
								/>
							</td>
						{/if}

						<!-- Cover -->
						<td class="p-3">
							{#if item.coverData}
								<img
									src={item.coverData}
									alt=""
									class="w-12 h-16 object-cover rounded"
								/>
							{:else}
								<div
									class="w-12 h-16 rounded flex items-center justify-center"
									style="background-color: var(--bg-tertiary);"
								>
									<FileText class="w-6 h-6" style="color: var(--text-tertiary);" />
								</div>
							{/if}
						</td>

						<!-- Title -->
						<td class="p-3">
							{#if editingItem === item.id}
								<input
									type="text"
									class="input"
									bind:value={editTitle}
									placeholder="Title"
								/>
							{:else}
								<div class="font-medium" style="color: var(--text-primary);">
									{item.parsedMetadata?.title || item.filename}
								</div>
								<div class="text-xs" style="color: var(--text-tertiary);">
									{item.filename}
								</div>
							{/if}
						</td>

						<!-- Author -->
						<td class="p-3">
							{#if editingItem === item.id}
								<input
									type="text"
									class="input"
									bind:value={editAuthor}
									placeholder="Author"
								/>
							{:else}
								<span style="color: var(--text-secondary);">
									{item.parsedMetadata?.authors?.join(', ') || '-'}
								</span>
							{/if}
						</td>

						<!-- Size -->
						<td class="p-3">
							<span style="color: var(--text-secondary);">
								{formatSize(item.fileSize)}
							</span>
						</td>

						<!-- Source -->
						<td class="p-3">
							<span
								class="px-2 py-1 rounded text-xs"
								style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
							>
								{item.source === 'upload' ? 'Upload' : 'Folder'}
							</span>
						</td>

						<!-- Actions -->
						<td class="p-3 text-right">
							<div class="flex items-center justify-end gap-2">
								{#if activeTab === 'pending'}
									{#if editingItem === item.id}
										<!-- Edit mode controls -->
										<select class="input text-sm py-1" bind:value={editStatusId}>
											<option value={null}>Status...</option>
											{#each data.statuses as status}
												<option value={status.id}>{status.name}</option>
											{/each}
										</select>
										<button
											class="p-2 rounded hover:bg-green-500/20 text-green-500"
											onclick={() => importItem(item.id)}
											title="Import"
										>
											<Check class="w-4 h-4" />
										</button>
										<button
											class="p-2 rounded hover:bg-red-500/20 text-red-500"
											onclick={cancelEdit}
											title="Cancel"
										>
											<X class="w-4 h-4" />
										</button>
									{:else}
										<button
											class="p-2 rounded hover:opacity-80"
											style="background-color: var(--bg-tertiary);"
											onclick={() => startEdit(item)}
											title="Edit & Import"
										>
											<Edit class="w-4 h-4" />
										</button>
										<button
											class="p-2 rounded bg-green-500/20 hover:bg-green-500/30 text-green-500"
											onclick={() => importItem(item.id)}
											title="Quick Import"
										>
											<Check class="w-4 h-4" />
										</button>
										<button
											class="p-2 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500"
											onclick={() => skipItem(item.id)}
											title="Skip"
										>
											<X class="w-4 h-4" />
										</button>
										<button
											class="p-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-500"
											onclick={() => deleteItem(item.id)}
											title="Delete"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									{/if}
								{:else if activeTab === 'failed'}
									<span class="text-xs text-red-400 mr-2" title={item.errorMessage}>
										{item.errorMessage?.substring(0, 30)}...
									</span>
									<button
										class="p-2 rounded hover:opacity-80"
										style="background-color: var(--bg-tertiary);"
										onclick={() => retryItem(item.id)}
										title="Retry"
									>
										<RefreshCw class="w-4 h-4" />
									</button>
									<button
										class="p-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-500"
										onclick={() => deleteItem(item.id)}
										title="Delete"
									>
										<Trash2 class="w-4 h-4" />
									</button>
								{:else if activeTab === 'imported'}
									{#if item.bookId}
										<a
											href="/books/{item.bookId}"
											class="p-2 rounded hover:opacity-80"
											style="background-color: var(--bg-tertiary);"
											title="View Book"
										>
											<Eye class="w-4 h-4" />
										</a>
									{/if}
								{:else}
									<button
										class="p-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-500"
										onclick={() => deleteItem(item.id)}
										title="Delete"
									>
										<Trash2 class="w-4 h-4" />
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan={activeTab === 'pending' ? 7 : 6} class="p-8 text-center">
							<div style="color: var(--text-tertiary);">
								{#if activeTab === 'pending'}
									No pending files. Upload or drop ebook files to get started.
								{:else}
									No {activeTab} items.
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
