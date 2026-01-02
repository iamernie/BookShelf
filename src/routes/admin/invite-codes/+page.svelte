<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Ticket,
		Plus,
		Trash2,
		Copy,
		Check,
		X,
		Clock,
		Users,
		AlertCircle,
		Loader2,
		UserCheck,
		UserX,
		ToggleLeft,
		ToggleRight
	} from 'lucide-svelte';

	let { data } = $props();

	// Create invite code state
	let showCreateModal = $state(false);
	let newCodeLabel = $state('');
	let newCodeMaxUses = $state('');
	let newCodeExpires = $state('');
	let creating = $state(false);
	let createError = $state('');

	// Copy to clipboard state
	let copiedCode = $state<string | null>(null);

	// Loading states
	let processingApproval = $state<number | null>(null);
	let processingCodeAction = $state<number | null>(null);

	async function createInviteCode() {
		createError = '';
		creating = true;

		try {
			const res = await fetch('/api/admin/invite-codes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					label: newCodeLabel || undefined,
					maxUses: newCodeMaxUses || undefined,
					expiresAt: newCodeExpires || undefined
				})
			});

			if (!res.ok) {
				const result = await res.json();
				createError = result.message || 'Failed to create invite code';
				return;
			}

			// Reset form and close modal
			newCodeLabel = '';
			newCodeMaxUses = '';
			newCodeExpires = '';
			showCreateModal = false;

			// Refresh data
			await invalidateAll();
		} catch (err) {
			createError = 'An error occurred';
		} finally {
			creating = false;
		}
	}

	async function copyCode(code: string) {
		await navigator.clipboard.writeText(code);
		copiedCode = code;
		setTimeout(() => {
			copiedCode = null;
		}, 2000);
	}

	async function toggleCodeActive(id: number, currentlyActive: boolean) {
		processingCodeAction = id;

		try {
			const res = await fetch('/api/admin/invite-codes', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, isActive: !currentlyActive })
			});

			if (res.ok) {
				await invalidateAll();
			}
		} finally {
			processingCodeAction = null;
		}
	}

	async function deleteCode(id: number) {
		if (!confirm('Are you sure you want to delete this invite code?')) {
			return;
		}

		processingCodeAction = id;

		try {
			const res = await fetch('/api/admin/invite-codes', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			if (res.ok) {
				await invalidateAll();
			}
		} finally {
			processingCodeAction = null;
		}
	}

	async function handleApproval(userId: number, action: 'approve' | 'reject') {
		if (action === 'reject' && !confirm('Are you sure you want to reject this user?')) {
			return;
		}

		processingApproval = userId;

		try {
			const res = await fetch('/api/admin/pending-approvals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, action })
			});

			if (res.ok) {
				await invalidateAll();
			}
		} finally {
			processingApproval = null;
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function isExpired(dateStr: string | null): boolean {
		if (!dateStr) return false;
		return new Date(dateStr) < new Date();
	}
</script>

<svelte:head>
	<title>Invite Codes & Approvals - Admin - BookShelf</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold" style="color: var(--text-primary);">
			Invite Codes & Approvals
		</h1>
		<p class="mt-1" style="color: var(--text-secondary);">
			Manage user registration invites and pending approvals
		</p>
	</div>

	<!-- Status Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
		<div class="card p-4">
			<div class="flex items-center gap-3">
				<div
					class="w-10 h-10 rounded-lg flex items-center justify-center"
					style="background: var(--bg-tertiary);"
				>
					<Ticket class="w-5 h-5" style="color: var(--accent);" />
				</div>
				<div>
					<p class="text-sm" style="color: var(--text-muted);">Active Invite Codes</p>
					<p class="text-xl font-bold" style="color: var(--text-primary);">
						{data.inviteCodes.filter((c) => c.isActive).length}
					</p>
				</div>
			</div>
		</div>

		<div class="card p-4">
			<div class="flex items-center gap-3">
				<div
					class="w-10 h-10 rounded-lg flex items-center justify-center"
					style="background: rgba(234, 179, 8, 0.2);"
				>
					<Clock class="w-5 h-5 text-yellow-500" />
				</div>
				<div>
					<p class="text-sm" style="color: var(--text-muted);">Pending Approvals</p>
					<p class="text-xl font-bold" style="color: var(--text-primary);">
						{data.pendingApprovals.length}
					</p>
				</div>
			</div>
		</div>

		<div class="card p-4">
			<div class="flex items-center gap-3">
				<div
					class="w-10 h-10 rounded-lg flex items-center justify-center"
					style="background: {data.settings.allowSignup
						? 'rgba(34, 197, 94, 0.2)'
						: 'rgba(239, 68, 68, 0.2)'};"
				>
					{#if data.settings.allowSignup}
						<Check class="w-5 h-5 text-green-500" />
					{:else}
						<X class="w-5 h-5 text-red-500" />
					{/if}
				</div>
				<div>
					<p class="text-sm" style="color: var(--text-muted);">Public Signup</p>
					<p
						class="text-xl font-bold"
						style="color: {data.settings.allowSignup ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'};"
					>
						{data.settings.allowSignup ? 'Enabled' : 'Disabled'}
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Pending Approvals Section -->
	{#if data.pendingApprovals.length > 0}
		<div class="card mb-8">
			<div class="p-4 border-b flex items-center gap-3" style="border-color: var(--border-color);">
				<Clock class="w-5 h-5 text-yellow-500" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">
					Pending Approvals ({data.pendingApprovals.length})
				</h2>
			</div>

			<div class="divide-y" style="border-color: var(--border-color);">
				{#each data.pendingApprovals as user}
					<div class="p-4 flex items-center justify-between">
						<div>
							<p class="font-medium" style="color: var(--text-primary);">{user.username}</p>
							<p class="text-sm" style="color: var(--text-muted);">{user.email}</p>
							<p class="text-xs mt-1" style="color: var(--text-muted);">
								Registered: {formatDate(user.createdAt)}
								{#if user.inviteCodeUsed}
									<span class="ml-2">| Code: {user.inviteCodeUsed}</span>
								{/if}
							</p>
						</div>
						<div class="flex items-center gap-2">
							<button
								class="btn-ghost p-2 text-green-500 hover:bg-green-500/10"
								onclick={() => handleApproval(user.id, 'approve')}
								disabled={processingApproval === user.id}
								title="Approve"
							>
								{#if processingApproval === user.id}
									<Loader2 class="w-5 h-5 animate-spin" />
								{:else}
									<UserCheck class="w-5 h-5" />
								{/if}
							</button>
							<button
								class="btn-ghost p-2 text-red-500 hover:bg-red-500/10"
								onclick={() => handleApproval(user.id, 'reject')}
								disabled={processingApproval === user.id}
								title="Reject"
							>
								<UserX class="w-5 h-5" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Invite Codes Section -->
	<div class="card">
		<div
			class="p-4 border-b flex items-center justify-between"
			style="border-color: var(--border-color);"
		>
			<div class="flex items-center gap-3">
				<Ticket class="w-5 h-5" style="color: var(--accent);" />
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Invite Codes</h2>
			</div>
			<button class="btn-accent flex items-center gap-2" onclick={() => (showCreateModal = true)}>
				<Plus class="w-4 h-4" />
				Create Code
			</button>
		</div>

		{#if !data.settings.requireInviteCode}
			<div
				class="p-4 flex items-center gap-3"
				style="background: rgba(234, 179, 8, 0.1); border-bottom: 1px solid var(--border-color);"
			>
				<AlertCircle class="w-5 h-5 text-yellow-500 flex-shrink-0" />
				<p class="text-sm text-yellow-600 dark:text-yellow-400">
					Invite codes are not currently required for registration. Enable "Require Invite Code" in
					<a href="/admin/settings" class="underline">System Settings</a> to enforce invite-only registration.
				</p>
			</div>
		{/if}

		{#if data.inviteCodes.length === 0}
			<div class="p-8 text-center">
				<Ticket class="w-12 h-12 mx-auto mb-4" style="color: var(--text-muted);" />
				<p style="color: var(--text-muted);">No invite codes created yet</p>
				<button
					class="btn-accent mt-4 inline-flex items-center gap-2"
					onclick={() => (showCreateModal = true)}
				>
					<Plus class="w-4 h-4" />
					Create Your First Code
				</button>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr style="background: var(--bg-tertiary);">
							<th class="px-4 py-3 text-left text-sm font-medium" style="color: var(--text-muted);"
								>Code</th
							>
							<th class="px-4 py-3 text-left text-sm font-medium" style="color: var(--text-muted);"
								>Label</th
							>
							<th class="px-4 py-3 text-left text-sm font-medium" style="color: var(--text-muted);"
								>Uses</th
							>
							<th class="px-4 py-3 text-left text-sm font-medium" style="color: var(--text-muted);"
								>Expires</th
							>
							<th class="px-4 py-3 text-left text-sm font-medium" style="color: var(--text-muted);"
								>Status</th
							>
							<th class="px-4 py-3 text-right text-sm font-medium" style="color: var(--text-muted);"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="divide-y" style="border-color: var(--border-color);">
						{#each data.inviteCodes as code}
							{@const expired = isExpired(code.expiresAt)}
							{@const exhausted = code.maxUses !== null && code.usedCount >= code.maxUses}
							<tr
								class:opacity-50={!code.isActive || expired || exhausted}
								style="background: var(--bg-secondary);"
							>
								<td class="px-4 py-3">
									<div class="flex items-center gap-2">
										<code
											class="font-mono text-sm px-2 py-1 rounded"
											style="background: var(--bg-tertiary); color: var(--accent);"
										>
											{code.code}
										</code>
										<button
											class="btn-ghost p-1.5"
											onclick={() => copyCode(code.code)}
											title="Copy code"
										>
											{#if copiedCode === code.code}
												<Check class="w-4 h-4 text-green-500" />
											{:else}
												<Copy class="w-4 h-4" />
											{/if}
										</button>
									</div>
								</td>
								<td class="px-4 py-3 text-sm" style="color: var(--text-secondary);">
									{code.label || '-'}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-1">
										<Users class="w-4 h-4" style="color: var(--text-muted);" />
										<span class="text-sm" style="color: var(--text-secondary);">
											{code.usedCount}{code.maxUses !== null ? ` / ${code.maxUses}` : ''}
										</span>
									</div>
								</td>
								<td class="px-4 py-3 text-sm" style="color: var(--text-secondary);">
									{#if expired}
										<span class="text-red-500">Expired</span>
									{:else}
										{formatDate(code.expiresAt)}
									{/if}
								</td>
								<td class="px-4 py-3">
									{#if !code.isActive}
										<span
											class="text-xs px-2 py-1 rounded-full"
											style="background: rgba(239, 68, 68, 0.2); color: rgb(239, 68, 68);"
										>
											Inactive
										</span>
									{:else if expired}
										<span
											class="text-xs px-2 py-1 rounded-full"
											style="background: rgba(239, 68, 68, 0.2); color: rgb(239, 68, 68);"
										>
											Expired
										</span>
									{:else if exhausted}
										<span
											class="text-xs px-2 py-1 rounded-full"
											style="background: rgba(234, 179, 8, 0.2); color: rgb(234, 179, 8);"
										>
											Exhausted
										</span>
									{:else}
										<span
											class="text-xs px-2 py-1 rounded-full"
											style="background: rgba(34, 197, 94, 0.2); color: rgb(34, 197, 94);"
										>
											Active
										</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1">
										<button
											class="btn-ghost p-2"
											onclick={() => toggleCodeActive(code.id, code.isActive)}
											disabled={processingCodeAction === code.id}
											title={code.isActive ? 'Deactivate' : 'Activate'}
										>
											{#if processingCodeAction === code.id}
												<Loader2 class="w-4 h-4 animate-spin" />
											{:else if code.isActive}
												<ToggleRight class="w-5 h-5 text-green-500" />
											{:else}
												<ToggleLeft class="w-5 h-5" style="color: var(--text-muted);" />
											{/if}
										</button>
										<button
											class="btn-ghost p-2 text-red-500 hover:bg-red-500/10"
											onclick={() => deleteCode(code.id)}
											disabled={processingCodeAction === code.id}
											title="Delete"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Create Invite Code Modal -->
{#if showCreateModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(0, 0, 0, 0.5);"
	>
		<div class="card p-6 w-full max-w-md" style="background: var(--bg-secondary);">
			<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">
				Create Invite Code
			</h3>

			{#if createError}
				<div
					class="mb-4 p-3 rounded-lg flex items-center gap-2"
					style="background: rgba(239, 68, 68, 0.1); color: rgb(239, 68, 68);"
				>
					<AlertCircle class="w-4 h-4" />
					{createError}
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					createInviteCode();
				}}
				class="space-y-4"
			>
				<div>
					<label
						for="label"
						class="block text-sm font-medium mb-1"
						style="color: var(--text-secondary);"
					>
						Label (optional)
					</label>
					<input
						type="text"
						id="label"
						bind:value={newCodeLabel}
						placeholder="e.g., Beta testers, Friends & Family"
						class="input"
					/>
					<p class="text-xs mt-1" style="color: var(--text-muted);">
						A note to help you identify this code
					</p>
				</div>

				<div>
					<label
						for="maxUses"
						class="block text-sm font-medium mb-1"
						style="color: var(--text-secondary);"
					>
						Max Uses (optional)
					</label>
					<input
						type="number"
						id="maxUses"
						bind:value={newCodeMaxUses}
						min="1"
						placeholder="Unlimited"
						class="input"
					/>
					<p class="text-xs mt-1" style="color: var(--text-muted);">
						Leave empty for unlimited uses
					</p>
				</div>

				<div>
					<label
						for="expires"
						class="block text-sm font-medium mb-1"
						style="color: var(--text-secondary);"
					>
						Expires (optional)
					</label>
					<input type="datetime-local" id="expires" bind:value={newCodeExpires} class="input" />
					<p class="text-xs mt-1" style="color: var(--text-muted);">
						Leave empty for no expiration
					</p>
				</div>

				<div class="flex justify-end gap-3 pt-4">
					<button type="button" class="btn-ghost" onclick={() => (showCreateModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn-accent" disabled={creating}>
						{#if creating}
							<Loader2 class="w-4 h-4 animate-spin mr-2" />
							Creating...
						{:else}
							Create Code
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
