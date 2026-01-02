<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import {
		ArrowLeft,
		Loader2,
		Mic,
		Headphones,
		Globe,
		Calendar,
		MapPin,
		Search,
		Download,
		X,
		Tag,
		Upload,
		Link,
		Trash2
	} from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import { toasts } from '$lib/stores/toast';
	import { formatDate, toInputDate } from '$lib/utils/date';

	interface WikiSearchResult {
		title: string;
		snippet: string;
		pageId: number;
		source: 'wikipedia' | 'fandom';
		preview?: {
			name: string;
			bio: string | null;
			photoUrl: string | null;
			wikipediaUrl: string;
			birthDate: string | null;
			deathDate: string | null;
			birthPlace: string | null;
			website: string | null;
		} | null;
	}

	let { data } = $props();
	const narrator = data.narrator;

	// Get return URL from query params
	let returnTo = $derived($page.url.searchParams.get('returnTo') || `/narrators/${narrator.id}`);

	let saving = $state(false);

	// Form fields
	let name = $state(narrator.name || '');
	let bio = $state(narrator.bio || '');
	let birthDate = $state(toInputDate(narrator.birthDate));
	let deathDate = $state(toInputDate(narrator.deathDate));
	let birthPlace = $state(narrator.birthPlace || '');
	let photoUrl = $state(narrator.photoUrl || '');
	let website = $state(narrator.website || '');
	let wikipediaUrl = $state(narrator.wikipediaUrl || '');
	let comments = $state(narrator.comments || '');

	// Wikipedia search state
	let showWikiSearch = $state(false);
	let wikiSearching = $state(false);
	let wikiResults = $state<WikiSearchResult[]>([]);
	let wikiError = $state<string | null>(null);
	let selectedResult = $state<WikiSearchResult | null>(null);
	let importing = $state(false);
	let searchSource = $state<'all' | 'wikipedia' | 'fandom'>('all');

	// Tag state
	let narratorTags = $state(data.narratorTags);
	let togglingTag = $state<number | null>(null);

	// Photo upload state
	let photoInputRef = $state<HTMLInputElement | null>(null);
	let uploadingPhoto = $state(false);
	let downloadingPhoto = $state(false);
	let photoUrlInput = $state(''); // Separate from photoUrl for the download URL input

	async function downloadPhotoFromUrl() {
		if (!photoUrlInput.trim()) {
			toasts.error('Please enter a URL');
			return;
		}
		downloadingPhoto = true;
		try {
			const res = await fetch('/api/photos/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: photoUrlInput.trim(),
					type: 'narrator',
					id: narrator.id
				})
			});
			if (res.ok) {
				const result = await res.json();
				photoUrl = result.photoPath;
				photoUrlInput = '';
				toasts.success('Photo downloaded successfully');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to download photo');
			}
		} catch {
			toasts.error('Failed to download photo');
		} finally {
			downloadingPhoto = false;
		}
	}

	async function handlePhotoUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploadingPhoto = true;
		try {
			const formData = new FormData();
			formData.append('photo', file);
			formData.append('type', 'narrator');
			formData.append('id', narrator.id.toString());

			const res = await fetch('/api/photos/upload', {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				const result = await res.json();
				photoUrl = result.photoPath;
				toasts.success('Photo uploaded successfully');
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to upload photo');
			}
		} catch {
			toasts.error('Failed to upload photo');
		} finally {
			uploadingPhoto = false;
			// Reset input
			if (input) input.value = '';
		}
	}

	function removePhoto() {
		photoUrl = '';
		toasts.success('Photo removed');
	}

	async function toggleTag(tagId: number) {
		togglingTag = tagId;
		try {
			const res = await fetch(`/api/narrators/${narrator.id}/tags`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tagId })
			});
			if (res.ok) {
				const result = await res.json();
				if (result.action === 'added') {
					const addedTag = data.allTags.find(t => t.id === tagId);
					if (addedTag) {
						narratorTags = [...narratorTags, addedTag];
					}
				} else {
					narratorTags = narratorTags.filter(t => t.id !== tagId);
				}
			} else {
				const err = await res.json();
				toasts.error(err.message || 'Failed to toggle tag');
			}
		} finally {
			togglingTag = null;
		}
	}

	async function handleSave() {
		if (!name.trim()) return;
		saving = true;
		try {
			const res = await fetch(`/api/narrators/${narrator.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					bio: bio.trim() || null,
					birthDate: birthDate || null,
					deathDate: deathDate || null,
					birthPlace: birthPlace.trim() || null,
					photoUrl: photoUrl.trim() || null,
					website: website.trim() || null,
					wikipediaUrl: wikipediaUrl.trim() || null,
					comments: comments.trim() || null
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toasts.error(err.message || 'Failed to save narrator');
				return;
			}

			toasts.success('Narrator saved');
			await tick();
			goto(decodeURIComponent(returnTo));
		} finally {
			saving = false;
		}
	}

	async function searchWikipedia() {
		if (!name.trim()) {
			toasts.warning('Enter a narrator name first');
			return;
		}

		wikiSearching = true;
		wikiError = null;
		wikiResults = [];
		selectedResult = null;

		try {
			const res = await fetch(
				`/api/narrators/wikipedia?name=${encodeURIComponent(name.trim())}&source=${searchSource}`
			);
			const data = await res.json();

			if (data.success && data.results?.length > 0) {
				wikiResults = data.results;
				showWikiSearch = true;
			} else {
				wikiError = data.error || 'No results found';
				showWikiSearch = true;
			}
		} catch {
			wikiError = 'Failed to search';
			showWikiSearch = true;
		} finally {
			wikiSearching = false;
		}
	}

	function selectResult(result: WikiSearchResult) {
		selectedResult = result;
	}

	async function importWikipediaData() {
		if (!selectedResult?.preview) return;

		const preview = selectedResult.preview;
		importing = true;

		try {
			const res = await fetch(`/api/narrators/${narrator.id}/wikipedia`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bio: preview.bio,
					birthDate: preview.birthDate,
					deathDate: preview.deathDate,
					birthPlace: preview.birthPlace,
					photoUrl: preview.photoUrl,
					website: preview.website,
					wikipediaUrl: preview.wikipediaUrl
				})
			});

			if (res.ok) {
				// Update local form fields
				if (preview.bio) bio = preview.bio;
				if (preview.birthDate) birthDate = preview.birthDate;
				if (preview.deathDate) deathDate = preview.deathDate;
				if (preview.birthPlace) birthPlace = preview.birthPlace;
				if (preview.photoUrl) photoUrl = preview.photoUrl;
				if (preview.website) website = preview.website;
				if (preview.wikipediaUrl) wikipediaUrl = preview.wikipediaUrl;

				toasts.success('Data imported successfully');
				showWikiSearch = false;
			} else {
				toasts.error('Failed to import data');
			}
		} finally {
			importing = false;
		}
	}

	function handleCancel() {
		goto(decodeURIComponent(returnTo));
	}
</script>

<svelte:head>
	<title>Edit {narrator.name} - BookShelf</title>
</svelte:head>

<div class="min-h-full" style="background-color: var(--bg-primary);">
	<!-- Header -->
	<div
		class="sticky top-0 z-20"
		style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border-color);"
	>
		<div class="max-w-4xl mx-auto px-4 sm:px-6">
			<div class="flex items-center justify-between h-16">
				<button
					type="button"
					class="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
					style="color: var(--text-secondary);"
					onclick={handleCancel}
				>
					<ArrowLeft class="w-4 h-4" />
					<span class="hidden sm:inline">Back</span>
				</button>

				<h1 class="font-semibold truncate max-w-[200px] sm:max-w-md" style="color: var(--text-primary);">
					Edit Narrator
				</h1>

				<div class="flex items-center gap-2">
					<button
						type="button"
						class="px-3 py-1.5 text-sm rounded-lg transition-colors"
						style="color: var(--text-muted);"
						onclick={handleCancel}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn-accent px-4 py-1.5 text-sm flex items-center gap-2"
						disabled={saving || !name.trim()}
						onclick={handleSave}
					>
						{#if saving}
							<Loader2 class="w-4 h-4 animate-spin" />
						{/if}
						Save
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-4xl mx-auto px-4 sm:px-6 py-6">
		<div class="flex gap-6">
			<!-- Sidebar with Photo and Stats -->
			<div class="hidden lg:block w-48 flex-shrink-0">
				<div class="sticky top-20 space-y-4">
					<!-- Narrator Photo -->
					<div
						class="rounded-lg p-4"
						style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
					>
						{#if photoUrl}
							<img
								src={photoUrl}
								alt={name}
								class="w-full aspect-square object-cover rounded-lg mb-3"
								onerror={(e) => {
									const img = e.currentTarget as HTMLImageElement;
									img.onerror = null;
									img.src = '/placeholder.png';
								}}
							/>
						{:else}
							<div
								class="w-full aspect-square rounded-lg flex items-center justify-center mb-3"
								style="background-color: var(--bg-tertiary);"
							>
								<Mic class="w-12 h-12" style="color: var(--text-muted);" />
							</div>
						{/if}
					</div>

					<!-- Narrator Stats Card -->
					<div
						class="rounded-lg p-4"
						style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
					>
						<h3 class="text-xs font-medium mb-3" style="color: var(--text-muted);">Stats</h3>
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--text-muted);">Audiobooks</span>
								<span class="text-sm font-medium" style="color: var(--text-primary);">
									{narrator.audiobookCount}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--text-muted);">Avg Rating</span>
								<span class="text-sm font-medium" style="color: var(--text-primary);">
									{narrator.avgRating ? narrator.avgRating.toFixed(1) : '-'}
								</span>
							</div>
						</div>
					</div>

					<!-- Quick View -->
					<a
						href="/narrators/{narrator.id}"
						class="w-full btn-ghost flex items-center justify-center gap-2 py-2 text-sm rounded-lg"
					>
						<Mic class="w-4 h-4" />
						View Narrator
					</a>
				</div>
			</div>

			<!-- Main Form -->
			<div class="flex-1 min-w-0">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSave();
					}}
				>
					<div class="space-y-4">
						<!-- Wikipedia/Fandom Search -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<div class="flex flex-wrap items-center gap-3 mb-3">
								<span class="text-xs font-medium" style="color: var(--text-muted);">Import from:</span>
								<div class="flex gap-1">
									<button
										type="button"
										class="px-2 py-1 text-xs rounded transition-colors"
										class:active-source={searchSource === 'all'}
										style="background-color: {searchSource === 'all'
											? 'var(--accent)'
											: 'var(--bg-tertiary)'}; color: {searchSource === 'all'
											? 'white'
											: 'var(--text-secondary)'};"
										onclick={() => (searchSource = 'all')}
									>
										All
									</button>
									<button
										type="button"
										class="px-2 py-1 text-xs rounded transition-colors"
										style="background-color: {searchSource === 'wikipedia'
											? 'var(--accent)'
											: 'var(--bg-tertiary)'}; color: {searchSource === 'wikipedia'
											? 'white'
											: 'var(--text-secondary)'};"
										onclick={() => (searchSource = 'wikipedia')}
									>
										Wikipedia
									</button>
									<button
										type="button"
										class="px-2 py-1 text-xs rounded transition-colors"
										style="background-color: {searchSource === 'fandom'
											? 'var(--accent)'
											: 'var(--bg-tertiary)'}; color: {searchSource === 'fandom'
											? 'white'
											: 'var(--text-secondary)'};"
										onclick={() => (searchSource = 'fandom')}
									>
										Fandom
									</button>
								</div>
								<button
									type="button"
									class="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
									style="background-color: var(--accent); color: white;"
									disabled={wikiSearching || !name.trim()}
									onclick={searchWikipedia}
								>
									{#if wikiSearching}
										<Loader2 class="w-3.5 h-3.5 animate-spin" />
									{:else}
										<Search class="w-3.5 h-3.5" />
									{/if}
									Search
								</button>
							</div>

							<!-- Search Results -->
							{#if showWikiSearch}
								<div class="pt-3 border-t" style="border-color: var(--border-color);">
									<div class="flex justify-between items-center mb-2">
										<span class="text-xs font-medium" style="color: var(--text-primary);"
											>Search Results</span
										>
										<button
											type="button"
											class="p-1 rounded hover:opacity-80"
											onclick={() => (showWikiSearch = false)}
										>
											<X class="w-4 h-4" style="color: var(--text-muted);" />
										</button>
									</div>

									{#if wikiError}
										<p class="text-sm text-center py-4" style="color: var(--text-muted);">
											{wikiError}
										</p>
									{:else if wikiResults.length > 0}
										<div class="max-h-64 overflow-y-auto space-y-2">
											{#each wikiResults as result}
												<button
													type="button"
													class="w-full flex gap-3 p-3 rounded-lg text-left transition-all"
													style="background-color: {selectedResult?.pageId === result.pageId
														? 'var(--bg-hover)'
														: 'var(--bg-tertiary)'}; border: 1px solid {selectedResult?.pageId ===
													result.pageId
														? 'var(--accent)'
														: 'var(--border-color)'};"
													onclick={() => selectResult(result)}
												>
													<div
														class="w-12 h-12 rounded flex-shrink-0 flex items-center justify-center overflow-hidden"
														style="background-color: var(--bg-secondary);"
													>
														{#if result.preview?.photoUrl}
															<img
																src={result.preview.photoUrl}
																alt=""
																class="w-full h-full object-cover"
															/>
														{:else}
															<Mic class="w-6 h-6" style="color: var(--text-muted);" />
														{/if}
													</div>
													<div class="flex-1 min-w-0">
														<div class="flex items-center gap-2">
															<span class="text-sm font-medium" style="color: var(--text-primary);">
																{result.title}
															</span>
															<span
																class="text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold"
																style="background-color: {result.source === 'wikipedia'
																	? 'rgba(26, 127, 55, 0.2)'
																	: 'rgba(196, 114, 12, 0.2)'}; color: {result.source === 'wikipedia'
																	? '#1a7f37'
																	: '#c4720c'};"
															>
																{result.source}
															</span>
														</div>
														{#if result.preview?.birthDate}
															<p class="text-xs mt-0.5" style="color: var(--text-muted);">
																Born: {formatDate(result.preview.birthDate)}
															</p>
														{/if}
														{#if result.preview?.bio}
															<p
																class="text-xs mt-1 line-clamp-2"
																style="color: var(--text-secondary);"
															>
																{result.preview.bio.substring(0, 120)}...
															</p>
														{/if}
													</div>
												</button>
											{/each}
										</div>

										{#if selectedResult?.preview}
											<button
												type="button"
												class="w-full mt-3 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors"
												style="background-color: var(--accent); color: white;"
												disabled={importing}
												onclick={importWikipediaData}
											>
												{#if importing}
													<Loader2 class="w-4 h-4 animate-spin" />
													Importing...
												{:else}
													<Download class="w-4 h-4" />
													Import Selected
												{/if}
											</button>
										{/if}
									{:else}
										<p class="text-sm text-center py-4" style="color: var(--text-muted);">
											No results found
										</p>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Name -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label for="name" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
								Name <span style="color: var(--accent);">*</span>
							</label>
							<input
								id="name"
								type="text"
								bind:value={name}
								required
								class="w-full px-3 py-2 rounded-md transition-all focus:ring-2 focus:ring-offset-0"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); --tw-ring-color: var(--accent);"
								placeholder="Narrator name"
							/>
						</div>

						<!-- Biography -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label for="bio" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
								Biography
							</label>
							<textarea
								id="bio"
								bind:value={bio}
								rows="4"
								class="w-full px-3 py-2 rounded-md text-sm resize-y"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
								placeholder="Narrator biography..."
							></textarea>
						</div>

						<!-- Dates and Location -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
								<Calendar class="w-3.5 h-3.5" />
								Life Details
							</h3>
							<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<div>
									<label for="birthDate" class="block text-xs mb-1" style="color: var(--text-muted);"
										>Birth Date</label
									>
									<input
										id="birthDate"
										type="date"
										bind:value={birthDate}
										class="w-full px-2 py-1.5 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
									/>
								</div>
								<div>
									<label for="deathDate" class="block text-xs mb-1" style="color: var(--text-muted);"
										>Death Date</label
									>
									<input
										id="deathDate"
										type="date"
										bind:value={deathDate}
										class="w-full px-2 py-1.5 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
									/>
								</div>
								<div>
									<label for="birthPlace" class="block text-xs mb-1" style="color: var(--text-muted);"
										>Birth Place</label
									>
									<input
										id="birthPlace"
										type="text"
										bind:value={birthPlace}
										class="w-full px-2 py-1.5 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										placeholder="City, Country"
									/>
								</div>
							</div>
						</div>

						<!-- Links -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
								<Globe class="w-3.5 h-3.5" />
								Links
							</h3>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label for="website" class="block text-xs mb-1" style="color: var(--text-muted);"
										>Website</label
									>
									<input
										id="website"
										type="url"
										bind:value={website}
										class="w-full px-2 py-1.5 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										placeholder="https://..."
									/>
								</div>
								<div>
									<label for="wikipediaUrl" class="block text-xs mb-1" style="color: var(--text-muted);"
										>Wikipedia URL</label
									>
									<input
										id="wikipediaUrl"
										type="url"
										bind:value={wikipediaUrl}
										class="w-full px-2 py-1.5 rounded-md text-sm"
										style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
										placeholder="https://en.wikipedia.org/..."
									/>
								</div>
							</div>
						</div>

						<!-- Photo -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
								<Upload class="w-3.5 h-3.5" />
								Photo
							</h3>

							{#if photoUrl}
								<!-- Current Photo -->
								<div class="flex items-start gap-4 mb-4">
									<img
										src={photoUrl}
										alt={name}
										class="w-20 h-20 object-cover rounded-lg"
										onerror={(e) => {
											const img = e.currentTarget as HTMLImageElement;
											img.onerror = null;
											img.src = '/placeholder.png';
										}}
									/>
									<div class="flex-1">
										<p class="text-xs mb-2" style="color: var(--text-muted);">Current photo</p>
										<p class="text-xs break-all mb-2" style="color: var(--text-primary);">{photoUrl}</p>
										<button
											type="button"
											class="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
											style="color: #ef4444;"
											onclick={removePhoto}
										>
											<Trash2 class="w-3 h-3" />
											Remove
										</button>
									</div>
								</div>
							{/if}

							<!-- Upload or Download Options -->
							<div class="space-y-3">
								<!-- Upload File -->
								<div>
									<input
										type="file"
										accept="image/*"
										class="hidden"
										bind:this={photoInputRef}
										onchange={handlePhotoUpload}
									/>
									<button
										type="button"
										class="w-full border-2 border-dashed rounded-lg p-4 text-center transition-all"
										style="border-color: var(--border-color); background-color: var(--bg-tertiary);"
										onclick={() => photoInputRef?.click()}
										disabled={uploadingPhoto}
									>
										{#if uploadingPhoto}
											<Loader2 class="w-6 h-6 mx-auto mb-1 animate-spin" style="color: var(--accent);" />
											<p class="text-xs" style="color: var(--accent);">Uploading...</p>
										{:else}
											<Upload class="w-6 h-6 mx-auto mb-1" style="color: var(--text-muted);" />
											<p class="text-xs" style="color: var(--text-primary);">Click to upload photo</p>
											<p class="text-xs mt-1" style="color: var(--text-muted);">JPG, PNG, GIF, WebP (max 10MB)</p>
										{/if}
									</button>
								</div>

								<!-- Or divider -->
								<div class="flex items-center gap-3">
									<div class="flex-1 border-t" style="border-color: var(--border-color);"></div>
									<span class="text-xs" style="color: var(--text-muted);">or</span>
									<div class="flex-1 border-t" style="border-color: var(--border-color);"></div>
								</div>

								<!-- Download from URL -->
								<div class="flex gap-2">
									<div class="relative flex-1">
										<Link class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4" style="color: var(--text-muted);" />
										<input
											type="url"
											bind:value={photoUrlInput}
											class="w-full pl-8 pr-3 py-2 rounded-md text-sm"
											style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
											placeholder="Paste image URL..."
										/>
									</div>
									<button
										type="button"
										class="btn-secondary px-3 py-2 flex items-center gap-1.5"
										onclick={downloadPhotoFromUrl}
										disabled={downloadingPhoto || !photoUrlInput.trim()}
									>
										{#if downloadingPhoto}
											<Loader2 class="w-4 h-4 animate-spin" />
										{:else}
											<Download class="w-4 h-4" />
										{/if}
										<span class="text-sm">Download</span>
									</button>
								</div>
							</div>
						</div>

						<!-- Notes -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<label for="comments" class="block text-xs font-medium mb-1.5" style="color: var(--text-muted);">
								Personal Notes
							</label>
							<textarea
								id="comments"
								bind:value={comments}
								rows="3"
								class="w-full px-3 py-2 rounded-md text-sm resize-y"
								style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
								placeholder="Your personal notes..."
							></textarea>
						</div>

						<!-- Tags -->
						<div
							class="rounded-lg p-4"
							style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
						>
							<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
								<Tag class="w-3.5 h-3.5" />
								Tags
							</h3>
							<div class="flex flex-wrap gap-2">
								{#each data.allTags as tag (tag.id)}
									{@const isSelected = narratorTags.some(t => t.id === tag.id)}
									<button
										type="button"
										class="tag-toggle-btn"
										class:selected={isSelected}
										disabled={togglingTag === tag.id}
										onclick={() => toggleTag(tag.id)}
										style="--tag-color: {tag.color || '#6c757d'}"
									>
										{#if tag.icon}
											<DynamicIcon icon={tag.icon} size={12} />
										{:else}
											<span class="tag-dot" style="background-color: {tag.color || '#6c757d'}"></span>
										{/if}
										{tag.name}
									</button>
								{/each}
								{#if data.allTags.length === 0}
									<span class="text-xs" style="color: var(--text-muted);">No tags available. Create tags in the catalog manager.</span>
								{/if}
							</div>
						</div>

						<!-- Audiobooks by Narrator (Read-only reference) -->
						{#if data.audiobooks.length > 0}
							<div
								class="rounded-lg p-4"
								style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);"
							>
								<h3 class="text-xs font-medium mb-3 flex items-center gap-2" style="color: var(--text-muted);">
									<Headphones class="w-3.5 h-3.5" />
									Audiobooks ({data.audiobooks.length})
								</h3>
								<div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
									{#each data.audiobooks as audiobook}
										<button
											type="button"
											class="flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors hover:opacity-80"
											style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
											onclick={() => {
												if (audiobook.bookId) {
													goto(`/books/${audiobook.bookId}`);
												} else {
													goto(`/audiobooks/${audiobook.id}`);
												}
											}}
										>
											{#if audiobook.coverPath}
												<img
													src={audiobook.coverPath}
													alt=""
													class="w-6 h-6 object-cover rounded"
													onerror={(e) => {
														(e.currentTarget as HTMLImageElement).src = '/placeholder.png';
													}}
												/>
											{:else}
												<Headphones class="w-4 h-4" />
											{/if}
											{audiobook.title}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</form>
			</div>
		</div>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}

	/* Tag toggle buttons */
	.tag-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.625rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--border-color);
		background-color: var(--bg-tertiary);
		color: var(--text-secondary);
		transition: all 0.2s;
	}

	.tag-toggle-btn:hover:not(:disabled) {
		border-color: var(--tag-color);
		background-color: color-mix(in srgb, var(--tag-color) 10%, transparent);
	}

	.tag-toggle-btn.selected {
		border-color: var(--tag-color);
		background-color: color-mix(in srgb, var(--tag-color) 20%, transparent);
		color: var(--tag-color);
	}

	.tag-toggle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tag-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
