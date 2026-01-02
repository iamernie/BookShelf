<script lang="ts">
	import { onMount } from 'svelte';
	import { Bookmark, AlertTriangle } from 'lucide-svelte';
	import StatusCard from '$lib/components/status/StatusCard.svelte';
	import StatusModal from '$lib/components/status/StatusModal.svelte';
	import { toasts } from '$lib/stores/toast';

	interface StatusWithCount {
		id: number;
		name: string;
		key: string | null;
		color: string | null;
		icon: string | null;
		isSystem: boolean | null;
		sortOrder: number | null;
		bookCount: number;
		createdAt: string | null;
		updatedAt: string | null;
	}

	let statuses = $state<StatusWithCount[]>([]);
	let loading = $state(true);
	let total = $state(0);

	// Modal state
	let showModal = $state(false);
	let selectedStatus = $state<StatusWithCount | null>(null);
	let modalMode = $state<'view' | 'edit'>('view');
	let statusBooks = $state<{ id: number; title: string; coverImageUrl: string | null }[]>([]);

	async function loadStatuses() {
		loading = true;
		try {
			const response = await fetch('/api/statuses');
			if (!response.ok) throw new Error('Failed to load statuses');

			const data = await response.json();
			statuses = data.items;
			total = data.total;
		} catch (err) {
			console.error('Error loading statuses:', err);
			toasts.error('Failed to load statuses');
		} finally {
			loading = false;
		}
	}

	async function openStatus(status: StatusWithCount) {
		try {
			const response = await fetch(`/api/statuses/${status.id}`);
			if (!response.ok) throw new Error('Failed to load status');

			const data = await response.json();
			selectedStatus = data.status;
			statusBooks = data.books;
			modalMode = 'view';
			showModal = true;
		} catch (err) {
			console.error('Error loading status:', err);
			toasts.error('Failed to load status details');
		}
	}

	async function saveStatus(data: { name: string }) {
		if (!selectedStatus) return;

		const response = await fetch(`/api/statuses/${selectedStatus.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || 'Failed to save status');
		}

		toasts.success('Status name updated');
		await loadStatuses();
	}

	onMount(() => {
		loadStatuses();
	});
</script>

<svelte:head>
	<title>Statuses - BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
				<Bookmark class="w-7 h-7" />
				Reading Statuses
			</h1>
			<p class="mt-1" style="color: var(--text-muted);">{total} statuses</p>
		</div>
	</div>

	<!-- Info Banner -->
	<div class="flex items-start gap-3 p-4 mb-6 rounded-lg" style="background-color: var(--bg-warning); border: 1px solid var(--border-warning);">
		<AlertTriangle class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: var(--text-warning);" />
		<div class="text-sm" style="color: var(--text-warning);">
			<p class="font-medium">Reading statuses are system-defined</p>
			<p class="mt-1">Statuses like "Read", "Reading", "To Read", etc. are built into the application and cannot be added or removed. You can only rename them for localization purposes.</p>
		</div>
	</div>

	<!-- Statuses Grid -->
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else if statuses.length === 0}
		<div class="text-center py-12">
			<Bookmark class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
			<h3 class="text-lg font-medium mb-2" style="color: var(--text-primary);">No statuses found</h3>
			<p style="color: var(--text-muted);">Statuses should be initialized by the system.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each statuses as status (status.id)}
				<StatusCard {status} onclick={() => openStatus(status)} />
			{/each}
		</div>
	{/if}
</div>

<!-- Status Modal -->
{#if showModal && selectedStatus}
	<StatusModal
		status={selectedStatus}
		books={statusBooks}
		mode={modalMode}
		onClose={() => showModal = false}
		onSave={saveStatus}
	/>
{/if}
