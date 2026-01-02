<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import TopNavbar from '$lib/components/layout/TopNavbar.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import WhatsNewModal from '$lib/components/WhatsNewModal.svelte';
	import { toasts } from '$lib/stores/toast';
	import { page } from '$app/stores';

	let { children, data } = $props();

	// Mobile sidebar state
	let sidebarOpen = $state(false);

	// Check if we're on special pages (no layout)
	let isReaderPage = $derived($page.url.pathname.startsWith('/reader/'));
	let isLoginPage = $derived($page.url.pathname === '/login');
</script>

{#if isReaderPage || isLoginPage}
	<!-- No layout for reader and login pages -->
	{@render children()}
{:else}
	<div class="flex h-screen overflow-hidden">
		<!-- Sidebar - Desktop -->
		{#if data.user}
			<div class="hidden lg:flex lg:flex-shrink-0">
				<Sidebar data={data.sidebar} />
			</div>
		{/if}

		<!-- Sidebar - Mobile overlay -->
		{#if sidebarOpen && data.user}
			<div class="fixed inset-0 z-50 lg:hidden">
				<!-- Backdrop -->
				<button
					class="absolute inset-0 bg-black/50"
					onclick={() => sidebarOpen = false}
					aria-label="Close sidebar"
				></button>
				<!-- Sidebar -->
				<div class="absolute left-0 top-0 h-full w-64 slide-in-left">
					<Sidebar data={data.sidebar} />
				</div>
			</div>
		{/if}

		<!-- Main content area -->
		<div class="flex-1 flex flex-col overflow-hidden">
			{#if data.user}
				<TopNavbar user={data.user} onToggleSidebar={() => sidebarOpen = !sidebarOpen} />
			{/if}

			<main class="flex-1 overflow-y-auto" style="background-color: var(--bg-primary);">
				{@render children()}
			</main>
		</div>
	</div>
{/if}

<!-- Toast notifications -->
<div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
	{#each $toasts as toast (toast.id)}
		<Toast {toast} />
	{/each}
</div>

<!-- What's New modal for admin users -->
{#if data.whatsNew?.show && data.whatsNew.changelog}
	<WhatsNewModal
		version={data.whatsNew.version}
		changelog={data.whatsNew.changelog}
		onClose={() => {}}
	/>
{/if}
