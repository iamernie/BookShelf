<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Sparkles,
		BookOpen,
		User,
		Folder,
		RefreshCw,
		Loader2,
		Plus,
		ExternalLink,
		Check,
		AlertCircle
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let { data } = $props();

	// AI state
	let aiLoading = $state(false);
	let aiError = $state<string | null>(null);
	let aiRecommendations = $state<
		{
			title: string;
			author: string;
			reason: string;
			inLibrary: boolean;
			bookId?: number;
			adding?: boolean;
			added?: boolean;
		}[]
	>([]);
	let aiModel = $state('');
	let aiBasedOnBooks = $state(0);

	async function loadAIRecommendations() {
		if (!data.aiEnabled) return;

		aiLoading = true;
		aiError = null;

		try {
			const res = await fetch('/api/recommendations/ai?limit=10');
			const result = await res.json();

			if (result.error) {
				aiError = result.error;
			} else {
				aiRecommendations = result.recommendations.map(
					(r: { title: string; author: string; reason: string; inLibrary: boolean; bookId?: number }) => ({
						...r,
						adding: false,
						added: false
					})
				);
				aiModel = result.model;
				aiBasedOnBooks = result.basedOnBooks;
			}
		} catch {
			aiError = 'Failed to load AI recommendations';
		} finally {
			aiLoading = false;
		}
	}

	async function addToLibrary(index: number) {
		const rec = aiRecommendations[index];
		if (rec.inLibrary || rec.adding) return;

		aiRecommendations[index].adding = true;

		try {
			const res = await fetch('/api/recommendations/ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: rec.title, author: rec.author })
			});

			const result = await res.json();

			if (result.success) {
				aiRecommendations[index].added = true;
				aiRecommendations[index].inLibrary = true;
				aiRecommendations[index].bookId = result.bookId;
				toasts.success(`Added "${rec.title}" to your wishlist`);
			} else {
				toasts.error(result.error || 'Failed to add book');
			}
		} catch {
			toasts.error('Failed to add book to wishlist');
		} finally {
			aiRecommendations[index].adding = false;
		}
	}

	function googleSearch(title: string, author: string) {
		const query = encodeURIComponent(`${title} ${author} book`);
		window.open(`https://www.google.com/search?q=${query}`, '_blank');
	}

	onMount(() => {
		if (data.aiEnabled) {
			loadAIRecommendations();
		}
	});

	const typeIcons: Record<string, typeof BookOpen> = {
		series: BookOpen,
		author: User,
		genre: Folder
	};
</script>

<svelte:head>
	<title>Recommendations - BookShelf</title>
</svelte:head>

<div class="p-6 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Recommendations</h1>
		<p style="color: var(--text-secondary);">
			Discover your next great read based on your library
		</p>
	</div>

	<!-- AI Recommendations Section -->
	{#if data.aiEnabled}
		<div
			class="card p-6 mb-8"
			style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);"
		>
			<div class="flex items-center justify-between mb-6">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
						<Sparkles class="w-5 h-5 text-white" />
					</div>
					<div>
						<h2 class="text-xl font-bold text-white">AI-Powered Picks</h2>
						<p class="text-sm text-white/70">
							{#if aiModel}
								Powered by {aiModel} • Based on {aiBasedOnBooks} books
							{:else}
								Personalized recommendations from ChatGPT
							{/if}
						</p>
					</div>
				</div>
				<button
					class="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
					onclick={loadAIRecommendations}
					disabled={aiLoading}
				>
					{#if aiLoading}
						<Loader2 class="w-5 h-5 animate-spin" />
					{:else}
						<RefreshCw class="w-5 h-5" />
					{/if}
				</button>
			</div>

			{#if aiLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="w-8 h-8 text-white animate-spin" />
					<span class="ml-3 text-white">Getting personalized recommendations...</span>
				</div>
			{:else if aiError}
				<div class="flex items-center gap-3 p-4 rounded-lg bg-white/10">
					<AlertCircle class="w-5 h-5 text-white/70" />
					<span class="text-white/90">{aiError}</span>
				</div>
			{:else if aiRecommendations.length > 0}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					{#each aiRecommendations as rec, i}
						<div class="p-4 rounded-lg bg-white/10 backdrop-blur">
							<div class="flex justify-between items-start gap-3">
								<div class="flex-1 min-w-0">
									<h3 class="font-semibold text-white truncate">{rec.title}</h3>
									<p class="text-sm text-white/70">{rec.author}</p>
									<p class="text-sm text-white/60 mt-2 line-clamp-2">{rec.reason}</p>
								</div>
								<div class="flex flex-col gap-2">
									{#if rec.inLibrary}
										{#if rec.added}
											<span class="text-xs px-2 py-1 rounded bg-green-500/30 text-green-200 flex items-center gap-1">
												<Check class="w-3 h-3" /> Added
											</span>
										{:else}
											<a
												href="/books/{rec.bookId}"
												class="text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors"
											>
												In Library
											</a>
										{/if}
									{:else}
										<button
											class="text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center gap-1"
											onclick={() => addToLibrary(i)}
											disabled={rec.adding}
										>
											{#if rec.adding}
												<Loader2 class="w-3 h-3 animate-spin" />
											{:else}
												<Plus class="w-3 h-3" />
											{/if}
											Wishlist
										</button>
									{/if}
									<button
										class="text-xs px-2 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-colors flex items-center gap-1"
										onclick={() => googleSearch(rec.title, rec.author)}
									>
										<ExternalLink class="w-3 h-3" /> Look Up
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8 text-white/70">
					No AI recommendations available. Try reading more books!
				</div>
			{/if}
		</div>
	{:else}
		<div class="card p-6 mb-8 text-center" style="background-color: var(--bg-tertiary);">
			<Sparkles class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="font-semibold mb-2" style="color: var(--text-primary);">AI Recommendations</h3>
			<p class="text-sm mb-4" style="color: var(--text-muted);">
				Get personalized book recommendations powered by ChatGPT.
			</p>
			<a href="/settings" class="btn-accent inline-flex items-center gap-2">
				Configure in Settings
			</a>
		</div>
	{/if}

	<!-- Rule-based Recommendations -->
	{#if data.ruleBasedRecommendations.length > 0}
		<div class="space-y-8">
			{#each data.ruleBasedRecommendations as section}
				{@const Icon = typeIcons[section.type] || BookOpen}
				<div class="card p-6">
					<div class="flex items-center gap-3 mb-4">
						<Icon class="w-5 h-5" style="color: var(--accent);" />
						<div>
							<h3 class="font-semibold" style="color: var(--text-primary);">{section.title}</h3>
							{#if section.subtitle}
								<p class="text-sm" style="color: var(--text-muted);">{section.subtitle}</p>
							{/if}
						</div>
					</div>

					<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
						{#each section.books as book}
							<a href="/books/{book.id}" class="group">
								<div class="aspect-[2/3] rounded-lg overflow-hidden mb-2 relative" style="background-color: var(--bg-tertiary);">
									<img
										src={book.coverImageUrl || '/placeholder.png'}
										alt={book.title}
										class="w-full h-full object-cover group-hover:scale-105 transition-transform"
										onerror={(e) => {
											(e.target as HTMLImageElement).src = '/placeholder.png';
										}}
									/>
									{#if book.bookNum}
										<div class="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded bg-black/70 text-white">
											#{book.bookNum}
										</div>
									{/if}
								</div>
								<h4
									class="text-sm font-medium truncate group-hover:underline"
									style="color: var(--text-primary);"
								>
									{book.title}
								</h4>
								{#if book.authorName}
									<p class="text-xs truncate" style="color: var(--text-muted);">
										{book.authorName}
									</p>
								{/if}
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else if !data.aiEnabled}
		<div class="card p-8 text-center">
			<BookOpen class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="font-semibold mb-2" style="color: var(--text-primary);">
				No Recommendations Yet
			</h3>
			<p style="color: var(--text-muted);">
				Start reading and rating books to get personalized recommendations!
			</p>
		</div>
	{/if}
</div>
