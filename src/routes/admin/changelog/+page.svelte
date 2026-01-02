<script lang="ts">
	import {
		Sparkles,
		Bug,
		Shield,
		Rocket,
		AlertTriangle,
		BookOpen,
		Code,
		Database,
		CheckCircle,
		RefreshCw,
		Trash2,
		Star,
		ChevronRight,
		FileText,
		Calendar
	} from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Map section title to icon component
	function getIconComponent(sectionTitle: string) {
		const title = sectionTitle.toLowerCase();

		if (title.includes('add')) return Sparkles;
		if (title.includes('fix') || title.includes('bug')) return Bug;
		if (title.includes('change')) return RefreshCw;
		if (title.includes('highlight')) return Star;
		if (title.includes('security')) return Shield;
		if (title.includes('remove') || title.includes('delet')) return Trash2;
		if (title.includes('deprecat') || title.includes('breaking')) return AlertTriangle;
		if (title.includes('performance') || title.includes('improve') || title.includes('enhance')) return Rocket;
		if (title.includes('doc')) return BookOpen;
		if (title.includes('code') || title.includes('refactor')) return Code;
		if (title.includes('database') || title.includes('schema') || title.includes('migration')) return Database;

		return CheckCircle;
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}
</script>

<svelte:head>
	<title>Changelog - BookShelf</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center gap-3 mb-2">
			<FileText class="w-8 h-8" style="color: var(--accent);" />
			<h1 class="text-3xl font-bold" style="color: var(--text-primary);">Changelog</h1>
		</div>
		<p class="text-lg" style="color: var(--text-muted);">
			All notable changes to BookShelf V2
		</p>
	</div>

	<!-- Version list -->
	<div class="space-y-8">
		{#each data.changelog as version, idx}
			<article class="card p-6">
				<!-- Version header -->
				<div class="flex items-center justify-between mb-4 pb-4 border-b" style="border-color: var(--border-color);">
					<div class="flex items-center gap-3">
						<span
							class="px-3 py-1 rounded-full text-sm font-bold"
							style="background-color: var(--accent); color: white;"
						>
							v{version.version}
						</span>
						{#if idx === 0}
							<span
								class="px-2 py-0.5 rounded text-xs font-medium"
								style="background-color: var(--success); color: white;"
							>
								Latest
							</span>
						{/if}
					</div>
					{#if version.date}
						<div class="flex items-center gap-2 text-sm" style="color: var(--text-muted);">
							<Calendar class="w-4 h-4" />
							<span>{formatDate(version.date)}</span>
						</div>
					{/if}
				</div>

				<!-- Sections -->
				<div class="space-y-6">
					{#each version.sections as section}
						{@const IconComponent = getIconComponent(section.title)}
						<div>
							<div class="flex items-center gap-2 mb-3">
								<div
									class="w-7 h-7 rounded-lg flex items-center justify-center"
									style="background-color: color-mix(in srgb, var(--accent) 15%, transparent);"
								>
									<IconComponent class="w-4 h-4" style="color: var(--accent);" />
								</div>
								<h3 class="font-semibold" style="color: var(--text-primary);">
									{section.title}
								</h3>
							</div>

							<div class="space-y-2 ml-9">
								{#each section.items as item}
									<div>
										<div class="flex items-start gap-2">
											<ChevronRight class="w-4 h-4 mt-0.5 flex-shrink-0" style="color: var(--accent);" />
											<div>
												<span class="font-medium" style="color: var(--text-primary);">
													{item.title}
												</span>
												{#if item.description}
													<span style="color: var(--text-secondary);">
														{' '}- {item.description}
													</span>
												{/if}
											</div>
										</div>

										{#if item.subItems && item.subItems.length > 0}
											<ul class="mt-1.5 ml-6 space-y-1">
												{#each item.subItems as subItem}
													<li class="text-sm flex items-start gap-2" style="color: var(--text-muted);">
														<span class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style="background-color: var(--text-muted);"></span>
														<span>{subItem}</span>
													</li>
												{/each}
											</ul>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</article>
		{/each}
	</div>

	{#if data.changelog.length === 0}
		<div class="card p-12 text-center">
			<FileText class="w-16 h-16 mx-auto mb-4" style="color: var(--text-muted);" />
			<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">No changelog available</h2>
			<p style="color: var(--text-muted);">The changelog file could not be found or is empty.</p>
		</div>
	{/if}
</div>
