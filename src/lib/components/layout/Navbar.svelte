<script lang="ts">
	import {
		BookOpen,
		Users,
		Library,
		Tag,
		BarChart3,
		Settings,
		Search,
		Plus,
		Menu,
		X,
		ChevronDown,
		LogOut,
		Upload,
		Wand2
	} from 'lucide-svelte';
	import GlobalSearch from '$lib/components/search/GlobalSearch.svelte';

	let { user }: { user: App.Locals['user'] } = $props();

	let mobileMenuOpen = $state(false);
	let userMenuOpen = $state(false);
	let searchOpen = $state(false);

	const navItems = [
		{ href: '/books', label: 'Books', icon: BookOpen },
		{ href: '/authors', label: 'Authors', icon: Users },
		{ href: '/series', label: 'Series', icon: Library },
		{ href: '/shelves', label: 'Collections', icon: Wand2 },
		{ href: '/tags', label: 'Tags', icon: Tag },
		{ href: '/stats', label: 'Stats', icon: BarChart3 },
		{ href: '/import', label: 'Import', icon: Upload }
	];

	// Global keyboard shortcut for search
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			searchOpen = true;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<nav class="bg-white border-b border-gray-200 sticky top-0 z-40">
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-2 text-xl font-bold text-primary-600">
				<BookOpen class="w-7 h-7" />
				<span class="hidden sm:inline">BookShelf</span>
			</a>

			<!-- Desktop Navigation -->
			<div class="hidden md:flex items-center gap-1">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
					>
						<item.icon class="w-4 h-4" />
						{item.label}
					</a>
				{/each}
			</div>

			<!-- Right side -->
			<div class="flex items-center gap-2">
				<!-- Search -->
				<button
					type="button"
					class="flex items-center gap-2 px-3 py-1.5 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
					onclick={() => searchOpen = true}
				>
					<Search class="w-4 h-4" />
					<span class="hidden sm:inline text-sm">Search</span>
					<kbd class="hidden md:inline text-xs bg-white px-1.5 py-0.5 rounded border text-gray-400">⌘K</kbd>
				</button>

				<!-- Add to Library -->
				<a href="/library/add" class="btn-primary btn-sm hidden sm:flex">
					<Plus class="w-4 h-4" />
					Add
				</a>

				<!-- User Menu -->
				<div class="relative">
					<button
						type="button"
						class="flex items-center gap-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
						onclick={() => (userMenuOpen = !userMenuOpen)}
					>
						<div
							class="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-medium"
						>
							{user?.username?.charAt(0).toUpperCase() || 'U'}
						</div>
						<ChevronDown class="w-4 h-4 hidden sm:block" />
					</button>

					{#if userMenuOpen}
						<div
							class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1"
						>
							<div class="px-4 py-2 border-b border-gray-100">
								<p class="text-sm font-medium text-gray-900">{user?.username}</p>
								<p class="text-xs text-gray-500">{user?.email}</p>
							</div>
							<a
								href="/settings"
								class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
							>
								<Settings class="w-4 h-4" />
								Settings
							</a>
							{#if user?.role === 'admin'}
								<a
									href="/admin"
									class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
								>
									<Settings class="w-4 h-4" />
									Admin
								</a>
							{/if}
							<form action="/logout" method="POST">
								<button
									type="submit"
									class="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
								>
									<LogOut class="w-4 h-4" />
									Logout
								</button>
							</form>
						</div>
					{/if}
				</div>

				<!-- Mobile menu button -->
				<button
					type="button"
					class="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
					onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				>
					{#if mobileMenuOpen}
						<X class="w-6 h-6" />
					{:else}
						<Menu class="w-6 h-6" />
					{/if}
				</button>
			</div>
		</div>

		<!-- Mobile Navigation -->
		{#if mobileMenuOpen}
			<div class="md:hidden py-4 border-t border-gray-100">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-3 px-4 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
						onclick={() => (mobileMenuOpen = false)}
					>
						<item.icon class="w-5 h-5" />
						{item.label}
					</a>
				{/each}
				<a
					href="/library/add"
					class="flex items-center gap-3 px-4 py-3 text-primary-600 hover:bg-primary-50 rounded-lg mt-2"
				>
					<Plus class="w-5 h-5" />
					Add to Library
				</a>
			</div>
		{/if}
	</div>
</nav>

<!-- Click outside to close menus -->
{#if userMenuOpen}
	<button
		type="button"
		class="fixed inset-0 z-30"
		onclick={() => (userMenuOpen = false)}
		aria-label="Close menu"
	></button>
{/if}

<!-- Global Search Modal -->
{#if searchOpen}
	<GlobalSearch onClose={() => searchOpen = false} />
{/if}
