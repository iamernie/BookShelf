<script lang="ts">
	import { page } from '$app/stores';
	import {
		Home,
		BookOpen,
		Users,
		Library,
		Bookmark,
		Tag,
		BarChart2,
		Settings,
		Plus,
		ChevronDown,
		ChevronRight,
		ChevronLeft,
		Disc,
		Mic,
		FolderOpen,
		Heart,
		Clock,
		CheckCircle,
		XCircle,
		Pause,
		Sparkles,
		Upload,
		Download,
		Layers,
		ListChecks,
		Wand2,
		Lightbulb,
		PanelLeftClose,
		PanelLeft,
		Database,
		Shield,
		Ticket,
		Activity,
		Inbox,
		LayoutDashboard,
		ShoppingBag,
		Merge
	} from 'lucide-svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import { APP_CONFIG } from '$lib/config/app';
	import { sidebarCollapsed } from '$lib/stores/sidebar';

	interface MagicShelf {
		id: number;
		name: string;
		iconColor: string | null;
		bookCount: number;
	}

	interface SidebarData {
		genres: { id: number; name: string; bookCount: number; color: string | null; icon: string | null }[];
		statuses: { id: number; name: string; key: string | null; bookCount: number; color: string | null }[];
		magicShelves?: MagicShelf[];
		totalBooks: number;
		isAdmin?: boolean;
		publicLibraryEnabled?: boolean;
	}

	let { data }: { data: SidebarData } = $props();

	// Collapsed state from store
	let collapsed = $state(false);

	// Subscribe to the store
	$effect(() => {
		const unsubscribe = sidebarCollapsed.subscribe((value) => {
			collapsed = value;
		});
		return unsubscribe;
	});

	function toggleCollapse() {
		sidebarCollapsed.update(v => !v);
	}

	// Collapsible sections state
	let librariesOpen = $state(true);
	let statusesOpen = $state(true);
	let smartCollectionsOpen = $state(true);
	let adminOpen = $state(true);

	// Active path
	let currentPath = $derived($page.url.pathname);

	function isActive(path: string): boolean {
		if (path === '/') return currentPath === '/';
		return currentPath.startsWith(path);
	}

	// Get icon for status based on key
	function getStatusIcon(key: string | null) {
		switch (key) {
			case 'READ': return CheckCircle;
			case 'READING': return BookOpen;
			case 'TO_READ': return Clock;
			case 'DNF': return XCircle;
			case 'PAUSED': return Pause;
			default: return Bookmark;
		}
	}
</script>

<aside class="sidebar h-full flex flex-col overflow-hidden transition-all duration-300" class:collapsed style="width: {collapsed ? '64px' : '256px'};">
	<!-- Logo / Brand -->
	<div class="p-4 flex items-center gap-3" class:justify-center={collapsed}>
		<img src="/bookshelflogo.png" alt="BookShelf" class="w-8 h-8 flex-shrink-0" />
		{#if !collapsed}
			<span class="text-lg font-bold whitespace-nowrap" style="color: var(--text-primary);">BookShelf</span>
		{/if}
	</div>

	<!-- Navigation -->
	<nav class="flex-1 overflow-y-auto py-2" class:px-3={!collapsed} class:px-2={collapsed}>
		<!-- Main Nav -->
		<div class="space-y-1">
			<a href="/" class="sidebar-item" class:active={isActive('/')} class:collapsed title={collapsed ? 'Dashboard' : undefined}>
				<Home class="w-5 h-5 flex-shrink-0" />
				{#if !collapsed}<span>Dashboard</span>{/if}
			</a>

			<a href="/books" class="sidebar-item" class:active={currentPath === '/books'} class:collapsed title={collapsed ? `My Books (${data.totalBooks})` : undefined}>
				<BookOpen class="w-5 h-5 flex-shrink-0" />
				{#if !collapsed}
					<span>My Books</span>
					<span class="ml-auto text-xs px-2 py-0.5 rounded-full" style="background-color: var(--bg-tertiary); color: var(--accent);">
						{data.totalBooks}
					</span>
				{/if}
			</a>

			{#if data.publicLibraryEnabled !== false}
				<a href="/library" class="sidebar-item" class:active={currentPath === '/library'} class:collapsed title={collapsed ? 'Public Library' : undefined}>
					<Library class="w-5 h-5 flex-shrink-0" />
					{#if !collapsed}<span>Public Library</span>{/if}
				</a>
			{/if}
		</div>

		<!-- Genres Section -->
		{#if !collapsed}
		<div class="mt-6">
			<button
				class="sidebar-section w-full flex items-center justify-between"
				onclick={() => librariesOpen = !librariesOpen}
			>
				<span>Genres</span>
				{#if librariesOpen}
					<ChevronDown class="w-4 h-4" />
				{:else}
					<ChevronRight class="w-4 h-4" />
				{/if}
			</button>

			{#if librariesOpen}
				<div class="mt-1 space-y-1">
					{#each data.genres.slice(0, 6) as genre}
						<a href="/books?genre={genre.id}" class="sidebar-item text-sm">
							{#if genre.icon}
								<DynamicIcon icon={genre.icon} size={16} color={genre.color || 'var(--text-muted)'} />
							{:else}
								<FolderOpen class="w-4 h-4" style="color: {genre.color || 'var(--text-muted)'};" />
							{/if}
							<span class="truncate">{genre.name}</span>
							<span class="ml-auto text-xs" style="color: var(--text-muted);">{genre.bookCount}</span>
						</a>
					{/each}
					{#if data.genres.length > 6}
						<a href="/genres" class="sidebar-item text-sm" style="color: var(--accent);">
							<Plus class="w-4 h-4" />
							<span>View all genres</span>
						</a>
					{/if}
				</div>
			{/if}
		</div>
		{/if}

		<!-- Statuses Section -->
		{#if !collapsed}
		<div class="mt-6">
			<button
				class="sidebar-section w-full flex items-center justify-between"
				onclick={() => statusesOpen = !statusesOpen}
			>
				<span>Statuses</span>
				{#if statusesOpen}
					<ChevronDown class="w-4 h-4" />
				{:else}
					<ChevronRight class="w-4 h-4" />
				{/if}
			</button>

			{#if statusesOpen}
				<div class="mt-1 space-y-1">
					{#each data.statuses as status}
						{@const StatusIcon = getStatusIcon(status.key)}
						<a href="/books?status={status.id}" class="sidebar-item text-sm">
							<StatusIcon class="w-4 h-4" style="color: {status.color || 'var(--text-muted)'};" />
							<span class="truncate">{status.name}</span>
							<span class="ml-auto text-xs" style="color: var(--text-muted);">{status.bookCount}</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>
		{/if}

		<!-- Smart Collections Section -->
		{#if !collapsed}
		<div class="mt-6">
			<button
				class="sidebar-section w-full flex items-center justify-between"
				onclick={() => smartCollectionsOpen = !smartCollectionsOpen}
			>
				<span class="flex items-center gap-1">
					<Wand2 class="w-3 h-3" style="color: var(--accent);" />
					Smart Collections
				</span>
				{#if smartCollectionsOpen}
					<ChevronDown class="w-4 h-4" />
				{:else}
					<ChevronRight class="w-4 h-4" />
				{/if}
			</button>

			{#if smartCollectionsOpen}
				<div class="mt-1 space-y-1">
					{#if data.magicShelves && data.magicShelves.length > 0}
						{#each data.magicShelves.slice(0, 5) as shelf}
							<a href="/shelves/{shelf.id}" class="sidebar-item text-sm" class:active={currentPath === `/shelves/${shelf.id}`}>
								<Wand2 class="w-4 h-4" style="color: {shelf.iconColor || 'var(--text-muted)'};" />
								<span class="truncate">{shelf.name}</span>
								<span class="ml-auto text-xs" style="color: var(--text-muted);">{shelf.bookCount}</span>
							</a>
						{/each}
					{/if}
					<!-- Always show link to manage collections -->
					<a href="/shelves" class="sidebar-item text-sm" class:active={currentPath === '/shelves'} style="color: var(--accent);">
						<Plus class="w-4 h-4" />
						<span>{data.magicShelves && data.magicShelves.length > 0 ? 'Manage Collections' : 'Create Collection'}</span>
					</a>
				</div>
			{/if}
		</div>
		{/if}

		<!-- Management Section -->
		{#if !collapsed}
		<div class="mt-6">
			<div class="sidebar-section">Manage</div>
			<div class="mt-1 space-y-1">
				<a href="/catalog" class="sidebar-item text-sm" class:active={isActive('/catalog')} style="color: var(--accent);">
					<Database class="w-4 h-4" />
					<span>Catalog Manager</span>
				</a>
				<a href="/authors" class="sidebar-item text-sm" class:active={isActive('/authors')}>
					<Users class="w-4 h-4" />
					<span>Authors</span>
				</a>
				<a href="/series" class="sidebar-item text-sm" class:active={isActive('/series')}>
					<Library class="w-4 h-4" />
					<span>Series</span>
				</a>
				<a href="/tags" class="sidebar-item text-sm" class:active={isActive('/tags')}>
					<Tag class="w-4 h-4" />
					<span>Tags</span>
				</a>
				<a href="/narrators" class="sidebar-item text-sm" class:active={isActive('/narrators')}>
					<Mic class="w-4 h-4" />
					<span>Narrators</span>
				</a>
				<a href="/genres" class="sidebar-item text-sm" class:active={isActive('/genres')}>
					<FolderOpen class="w-4 h-4" />
					<span>Genres</span>
				</a>
				<a href="/formats" class="sidebar-item text-sm" class:active={isActive('/formats')}>
					<Layers class="w-4 h-4" />
					<span>Formats</span>
				</a>
				<a href="/statuses" class="sidebar-item text-sm" class:active={isActive('/statuses')}>
					<ListChecks class="w-4 h-4" />
					<span>Statuses</span>
				</a>
			</div>
		</div>
		{/if}

		<!-- Import/Export Section -->
		{#if !collapsed}
		<div class="mt-6">
			<div class="sidebar-section">Data</div>
			<div class="mt-1 space-y-1">
				<a href="/import" class="sidebar-item text-sm" class:active={isActive('/import')}>
					<Upload class="w-4 h-4" />
					<span>Import</span>
				</a>
				<a href="/export" class="sidebar-item text-sm" class:active={isActive('/export')}>
					<Download class="w-4 h-4" />
					<span>Export</span>
				</a>
			</div>
		</div>
		{/if}

		<!-- Stats & More -->
		<div class="mt-6">
			{#if !collapsed}<div class="sidebar-section">More</div>{/if}
			<div class="mt-1 space-y-1">
				<a href="/stats" class="sidebar-item text-sm" class:active={isActive('/stats')} class:collapsed title={collapsed ? 'Statistics' : undefined}>
					<BarChart2 class="w-4 h-4 flex-shrink-0" />
					{#if !collapsed}<span>Statistics</span>{/if}
				</a>
				<a href="/recommendations" class="sidebar-item text-sm" class:active={isActive('/recommendations')} class:collapsed title={collapsed ? 'Recommendations' : undefined}>
					<Lightbulb class="w-4 h-4 flex-shrink-0" />
					{#if !collapsed}<span>Recommendations</span>{/if}
				</a>
				<a href="/search" class="sidebar-item text-sm" class:active={isActive('/search')} class:collapsed title={collapsed ? 'Advanced Search' : undefined}>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					{#if !collapsed}<span>Advanced Search</span>{/if}
				</a>
			</div>
		</div>

		<!-- Admin Section (only for admins) -->
		{#if data.isAdmin}
		{#if !collapsed}
		<div class="mt-6">
			<button
				class="sidebar-section w-full flex items-center justify-between"
				onclick={() => adminOpen = !adminOpen}
			>
				<span class="flex items-center gap-1">
					<Shield class="w-3 h-3" style="color: var(--accent);" />
					Admin
				</span>
				{#if adminOpen}
					<ChevronDown class="w-4 h-4" />
				{:else}
					<ChevronRight class="w-4 h-4" />
				{/if}
			</button>

			{#if adminOpen}
				<div class="mt-1 space-y-1">
					<a href="/admin/users" class="sidebar-item text-sm" class:active={isActive('/admin/users')}>
						<Users class="w-4 h-4" />
						<span>Users</span>
					</a>
					<a href="/admin/invite-codes" class="sidebar-item text-sm" class:active={isActive('/admin/invite-codes')}>
						<Ticket class="w-4 h-4" />
						<span>Invite Codes</span>
					</a>
					<a href="/admin/bookdrop" class="sidebar-item text-sm" class:active={isActive('/admin/bookdrop')}>
						<Inbox class="w-4 h-4" />
						<span>BookDrop</span>
					</a>
					<a href="/admin/media-sources" class="sidebar-item text-sm" class:active={isActive('/admin/media-sources')}>
						<ShoppingBag class="w-4 h-4" />
						<span>Media Sources</span>
					</a>
					<a href="/admin/diagnostics" class="sidebar-item text-sm" class:active={isActive('/admin/diagnostics')}>
						<Activity class="w-4 h-4" />
						<span>Diagnostics</span>
					</a>
					<a href="/admin/data-cleanup" class="sidebar-item text-sm" class:active={isActive('/admin/data-cleanup')}>
						<Merge class="w-4 h-4" />
						<span>Data Cleanup</span>
					</a>
					<a href="/admin/settings" class="sidebar-item text-sm" class:active={isActive('/admin/settings')}>
						<Settings class="w-4 h-4" />
						<span>Settings</span>
					</a>
				</div>
			{/if}
		</div>
		{:else}
			<!-- Collapsed admin view -->
			<div class="mt-6 space-y-1">
				<a href="/admin/settings" class="sidebar-item text-sm collapsed" class:active={isActive('/admin')} title="Admin">
					<Shield class="w-4 h-4 flex-shrink-0" style="color: var(--accent);" />
				</a>
			</div>
		{/if}
		{/if}
	</nav>

	<!-- Bottom section -->
	<div class="p-3 border-t" style="border-color: var(--border-color);">
		<!-- Collapse toggle button -->
		<button
			onclick={toggleCollapse}
			class="sidebar-item text-sm w-full"
			class:collapsed
			title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			{#if collapsed}
				<PanelLeft class="w-4 h-4 flex-shrink-0" />
			{:else}
				<PanelLeftClose class="w-4 h-4 flex-shrink-0" />
				<span>Collapse</span>
			{/if}
		</button>

		<!-- Version and Copyright -->
		{#if !collapsed}
		<div class="mt-3 pt-2 border-t text-center" style="border-color: var(--border-color);">
			<p class="text-[10px]" style="color: var(--text-muted);">
				{APP_CONFIG.versionString}
			</p>
			<p class="text-[10px]" style="color: var(--text-muted);">
				&copy; {APP_CONFIG.copyrightString}
			</p>
		</div>
		{/if}
	</div>
</aside>
