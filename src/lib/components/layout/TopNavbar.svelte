<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Search,
		Plus,
		Bell,
		User,
		LogOut,
		Settings,
		Menu,
		X,
		Upload,
		BarChart2,
		Heart,
		Moon,
		Sun,
		Monitor,
		Terminal,
		Shield,
		FolderDown,
		Target,
		Code,
		Activity,
		Users,
		Sliders,
		UserCog,
		Ticket
	} from 'lucide-svelte';
	import GlobalSearch from '$lib/components/search/GlobalSearch.svelte';
	import { theme } from '$lib/stores/theme';

	interface NavUser {
		id: number;
		username: string;
		email: string;
		role: string | null;
		isAdmin?: boolean;
	}

	let { user, onToggleSidebar }: { user: NavUser | null; onToggleSidebar?: () => void } = $props();

	let searchOpen = $state(false);
	let userMenuOpen = $state(false);
	let addMenuOpen = $state(false);
	let currentTheme = $state<'light' | 'dark' | 'system'>('system');

	// Subscribe to theme store
	$effect(() => {
		const unsubscribe = theme.subscribe(t => {
			currentTheme = t;
		});
		return unsubscribe;
	});

	// Keyboard shortcut for search
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			searchOpen = true;
		}
	}

	function closeMenus() {
		userMenuOpen = false;
		addMenuOpen = false;
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<header class="navbar h-14 flex items-center justify-between px-4 sticky top-0 z-40">
	<!-- Left side -->
	<div class="flex items-center gap-4">
		<!-- Mobile menu toggle -->
		<button
			class="lg:hidden btn-ghost btn-icon rounded-lg"
			onclick={onToggleSidebar}
			aria-label="Toggle sidebar"
		>
			<Menu class="w-5 h-5" />
		</button>

		<!-- Search button -->
		<button
			type="button"
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
			style="background-color: var(--bg-tertiary); color: var(--text-muted);"
			onclick={() => searchOpen = true}
			aria-label="Open search"
		>
			<Search class="w-4 h-4" />
			<span class="hidden sm:inline">Search...</span>
			<kbd class="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style="background-color: var(--bg-hover);">
				<span>⌘</span>K
			</kbd>
		</button>
	</div>

	<!-- Right side -->
	<div class="flex items-center gap-2">
		<!-- Quick Add button -->
		<div class="relative">
			<button
				class="btn-ghost btn-icon rounded-lg"
				onclick={() => { addMenuOpen = !addMenuOpen; userMenuOpen = false; }}
				aria-label="Quick add"
			>
				<Plus class="w-5 h-5" />
			</button>

			{#if addMenuOpen}
				<div class="dropdown-menu right-0 top-full mt-1 fade-in" onclick={closeMenus}>
					<a href="/library/add" class="dropdown-item">
						<Plus class="w-4 h-4" />
						<span>Add to Library</span>
					</a>
					<a href="/authors?add=true" class="dropdown-item">
						<User class="w-4 h-4" />
						<span>Add Author</span>
					</a>
					<a href="/series?add=true" class="dropdown-item">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
						</svg>
						<span>Add Series</span>
					</a>
				</div>
			{/if}
		</div>

		<!-- Stats shortcut -->
		<a href="/stats" class="btn-ghost btn-icon rounded-lg hidden sm:flex" aria-label="Statistics">
			<BarChart2 class="w-5 h-5" />
		</a>

		<!-- Goals shortcut -->
		<a href="/stats/goals" class="btn-ghost btn-icon rounded-lg hidden sm:flex" aria-label="Reading Goals">
			<Target class="w-5 h-5" />
		</a>

		<!-- Favorites shortcut -->
		<a href="/books?tag=favorite" class="btn-ghost btn-icon rounded-lg hidden sm:flex" aria-label="Favorites">
			<Heart class="w-5 h-5" />
		</a>

		<!-- Theme toggle -->
		<button
			class="btn-ghost btn-icon rounded-lg"
			onclick={() => theme.toggle()}
			aria-label="Toggle theme"
		>
			{#if currentTheme === 'system'}
				<Monitor class="w-5 h-5" />
			{:else if currentTheme === 'dark'}
				<Sun class="w-5 h-5" />
			{:else}
				<Moon class="w-5 h-5" />
			{/if}
		</button>

		<!-- User menu -->
		{#if user}
			<div class="relative ml-2">
				<button
					class="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
					onclick={() => { userMenuOpen = !userMenuOpen; addMenuOpen = false; }}
				>
					<div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style="background-color: var(--accent); color: white;">
						{user.username.charAt(0).toUpperCase()}
					</div>
				</button>

				{#if userMenuOpen}
					<div class="dropdown-menu right-0 top-full mt-1 w-52 fade-in">
						<div class="px-3 py-2 border-b" style="border-color: var(--border-color);">
							<p class="font-medium" style="color: var(--text-primary);">{user.username}</p>
							<p class="text-xs" style="color: var(--text-muted);">{user.email}</p>
						</div>
						<!-- Account Section -->
						<div class="px-3 py-1 mt-1">
							<span class="text-xs font-medium flex items-center gap-1" style="color: var(--text-muted);">
								<User class="w-3 h-3" />
								Account
							</span>
						</div>
						<a href="/account" class="dropdown-item" onclick={closeMenus}>
							<UserCog class="w-4 h-4" />
							<span>My Profile</span>
						</a>
						<a href="/account/settings" class="dropdown-item" onclick={closeMenus}>
							<Sliders class="w-4 h-4" />
							<span>My Preferences</span>
						</a>
						{#if user.role === 'admin'}
							<div class="border-t my-1" style="border-color: var(--border-color);"></div>
							<div class="px-3 py-1">
								<span class="text-xs font-medium flex items-center gap-1" style="color: var(--text-muted);">
									<Shield class="w-3 h-3" />
									Admin
								</span>
							</div>
							<a href="/admin/users" class="dropdown-item" onclick={closeMenus}>
								<Users class="w-4 h-4" />
								<span>Manage Users</span>
							</a>
							<a href="/admin/invite-codes" class="dropdown-item" onclick={closeMenus}>
								<Ticket class="w-4 h-4" />
								<span>Invite Codes</span>
							</a>
							<a href="/admin/settings" class="dropdown-item" onclick={closeMenus}>
								<Settings class="w-4 h-4" />
								<span>System Settings</span>
							</a>
							<a href="/admin/console" class="dropdown-item" onclick={closeMenus}>
								<Terminal class="w-4 h-4" />
								<span>Console</span>
							</a>
							<a href="/admin/bookdrop" class="dropdown-item" onclick={closeMenus}>
								<FolderDown class="w-4 h-4" />
								<span>BookDrop</span>
							</a>
							<a href="/admin/widgets" class="dropdown-item" onclick={closeMenus}>
								<Code class="w-4 h-4" />
								<span>Widgets</span>
							</a>
							<a href="/admin/diagnostics" class="dropdown-item" onclick={closeMenus}>
								<Activity class="w-4 h-4" />
								<span>Diagnostics</span>
							</a>
						{/if}
						<div class="border-t my-1" style="border-color: var(--border-color);"></div>
						<form action="/logout" method="POST" class="contents">
							<button type="submit" class="dropdown-item w-full text-left" style="color: #ef4444;">
								<LogOut class="w-4 h-4" />
								<span>Log out</span>
							</button>
						</form>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>

<!-- Global Search Modal -->
{#if searchOpen}
	<GlobalSearch onClose={() => searchOpen = false} />
{/if}

<!-- Click outside to close menus -->
{#if userMenuOpen || addMenuOpen}
	<button
		class="fixed inset-0 z-30"
		onclick={closeMenus}
		aria-label="Close menu"
	></button>
{/if}
