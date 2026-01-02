<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Users,
		UserPlus,
		Search,
		Shield,
		ShieldCheck,
		ShieldAlert,
		Eye,
		UserX,
		Pencil,
		Trash2,
		Lock,
		Unlock,
		ChevronLeft,
		ChevronRight,
		X,
		Check,
		Loader2,
		ArrowUpDown
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let { data } = $props();

	// Search & filter state
	let searchQuery = $state($page.url.searchParams.get('search') || '');
	let searchTimeout: ReturnType<typeof setTimeout>;

	// Modal state
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteConfirm = $state(false);
	let selectedUser = $state<any>(null);
	let loading = $state(false);

	// Form state
	let formData = $state({
		username: '',
		email: '',
		password: '',
		role: 'member' as string,
		firstName: '',
		lastName: ''
	});
	let formErrors = $state<Record<string, string>>({});

	// Role display info
	const roleInfo: Record<string, { label: string; color: string; icon: any }> = {
		admin: { label: 'Admin', color: '#ef4444', icon: ShieldAlert },
		librarian: { label: 'Librarian', color: '#f59e0b', icon: ShieldCheck },
		member: { label: 'Member', color: '#22c55e', icon: Shield },
		viewer: { label: 'Viewer', color: '#3b82f6', icon: Eye },
		guest: { label: 'Guest', color: '#6b7280', icon: UserX }
	};

	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			const url = new URL($page.url);
			if (searchQuery) {
				url.searchParams.set('search', searchQuery);
			} else {
				url.searchParams.delete('search');
			}
			url.searchParams.set('page', '1');
			goto(url.toString(), { replaceState: true });
		}, 300);
	}

	function handleSort(field: string) {
		const url = new URL($page.url);
		const currentSort = url.searchParams.get('sortBy');
		const currentOrder = url.searchParams.get('sortOrder') || 'desc';

		if (currentSort === field) {
			url.searchParams.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
		} else {
			url.searchParams.set('sortBy', field);
			url.searchParams.set('sortOrder', 'asc');
		}
		goto(url.toString(), { replaceState: true });
	}

	function goToPage(pageNum: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', pageNum.toString());
		goto(url.toString(), { replaceState: true });
	}

	function openCreateModal() {
		formData = {
			username: '',
			email: '',
			password: '',
			role: 'member',
			firstName: '',
			lastName: ''
		};
		formErrors = {};
		showCreateModal = true;
	}

	function openEditModal(user: any) {
		selectedUser = user;
		formData = {
			username: user.username,
			email: user.email,
			password: '',
			role: user.role,
			firstName: user.firstName || '',
			lastName: user.lastName || ''
		};
		formErrors = {};
		showEditModal = true;
	}

	function openDeleteConfirm(user: any) {
		selectedUser = user;
		showDeleteConfirm = true;
	}

	async function createUser() {
		loading = true;
		formErrors = {};

		try {
			const res = await fetch('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const result = await res.json();

			if (res.ok) {
				toasts.success('User created successfully');
				showCreateModal = false;
				invalidateAll();
			} else {
				formErrors.general = result.message || 'Failed to create user';
			}
		} catch {
			formErrors.general = 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function updateUser() {
		if (!selectedUser) return;
		loading = true;
		formErrors = {};

		const updates: Record<string, any> = {};
		if (formData.username !== selectedUser.username) updates.username = formData.username;
		if (formData.email !== selectedUser.email) updates.email = formData.email;
		if (formData.password) updates.password = formData.password;
		if (formData.role !== selectedUser.role) updates.role = formData.role;
		if (formData.firstName !== (selectedUser.firstName || '')) updates.firstName = formData.firstName;
		if (formData.lastName !== (selectedUser.lastName || '')) updates.lastName = formData.lastName;

		try {
			const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates)
			});

			const result = await res.json();

			if (res.ok) {
				toasts.success('User updated successfully');
				showEditModal = false;
				invalidateAll();
			} else {
				formErrors.general = result.message || 'Failed to update user';
			}
		} catch {
			formErrors.general = 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function deleteUser() {
		if (!selectedUser) return;
		loading = true;

		try {
			const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				toasts.success('User deleted');
				showDeleteConfirm = false;
				invalidateAll();
			} else {
				const result = await res.json();
				toasts.error(result.message || 'Failed to delete user');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			loading = false;
		}
	}

	async function unlockUser(userId: number) {
		try {
			const res = await fetch(`/api/admin/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'unlock' })
			});

			if (res.ok) {
				toasts.success('User unlocked');
				invalidateAll();
			} else {
				const result = await res.json();
				toasts.error(result.message || 'Failed to unlock user');
			}
		} catch {
			toasts.error('An error occurred');
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString();
	}
</script>

<svelte:head>
	<title>User Management | Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div class="flex items-center gap-3">
			<Users class="w-6 h-6" style="color: var(--accent);" />
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">User Management</h1>
		</div>
		<button type="button" class="btn-primary flex items-center gap-2" onclick={openCreateModal}>
			<UserPlus class="w-4 h-4" />
			Add User
		</button>
	</div>

	<!-- Role Stats -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
		{#each data.roles as role}
			{@const info = roleInfo[role] || { label: role, color: '#6b7280', icon: Users }}
			{@const RoleIcon = info.icon}
			<div class="card p-3 flex items-center gap-3">
				<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background-color: {info.color}20;">
					<RoleIcon class="w-5 h-5" style="color: {info.color};" />
				</div>
				<div>
					<p class="text-xl font-bold" style="color: var(--text-primary);">{data.roleCounts[role] || 0}</p>
					<p class="text-xs" style="color: var(--text-muted);">{info.label}s</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Search -->
	<div class="card p-4 mb-4">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color: var(--text-muted);" />
			<input
				type="text"
				placeholder="Search users by name or email..."
				class="w-full pl-10 pr-4 py-2 rounded-lg"
				style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);"
				bind:value={searchQuery}
				oninput={handleSearch}
			/>
		</div>
	</div>

	<!-- Users Table -->
	<div class="card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr style="background-color: var(--bg-tertiary);">
						<th class="table-header cursor-pointer" onclick={() => handleSort('username')}>
							<span class="flex items-center gap-1">
								Username
								<ArrowUpDown class="w-3 h-3" />
							</span>
						</th>
						<th class="table-header cursor-pointer" onclick={() => handleSort('email')}>
							<span class="flex items-center gap-1">
								Email
								<ArrowUpDown class="w-3 h-3" />
							</span>
						</th>
						<th class="table-header">Name</th>
						<th class="table-header cursor-pointer" onclick={() => handleSort('role')}>
							<span class="flex items-center gap-1">
								Role
								<ArrowUpDown class="w-3 h-3" />
							</span>
						</th>
						<th class="table-header">Status</th>
						<th class="table-header cursor-pointer" onclick={() => handleSort('createdAt')}>
							<span class="flex items-center gap-1">
								Created
								<ArrowUpDown class="w-3 h-3" />
							</span>
						</th>
						<th class="table-header text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user}
						{@const info = roleInfo[user.role] || { label: user.role, color: '#6b7280', icon: Users }}
						{@const RoleIcon = info.icon}
						<tr class="table-row">
							<td class="table-cell font-medium" style="color: var(--text-primary);">
								{user.username}
								{#if user.id === data.currentUserId}
									<span class="text-xs ml-1 px-1.5 py-0.5 rounded" style="background-color: var(--accent); color: white;">You</span>
								{/if}
							</td>
							<td class="table-cell" style="color: var(--text-secondary);">{user.email}</td>
							<td class="table-cell" style="color: var(--text-secondary);">
								{user.firstName || ''} {user.lastName || ''}
							</td>
							<td class="table-cell">
								<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style="background-color: {info.color}20; color: {info.color};">
									<RoleIcon class="w-3 h-3" />
									{info.label}
								</span>
							</td>
							<td class="table-cell">
								{#if user.isLocked}
									<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444;">
										<Lock class="w-3 h-3" />
										Locked
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style="background-color: rgba(34, 197, 94, 0.1); color: #22c55e;">
										<Check class="w-3 h-3" />
										Active
									</span>
								{/if}
							</td>
							<td class="table-cell" style="color: var(--text-muted);">{formatDate(user.createdAt)}</td>
							<td class="table-cell text-right">
								<div class="flex items-center justify-end gap-1">
									{#if user.isLocked}
										<button
											type="button"
											class="p-1.5 rounded hover:bg-opacity-10"
											style="color: #22c55e;"
											title="Unlock user"
											onclick={() => unlockUser(user.id)}
										>
											<Unlock class="w-4 h-4" />
										</button>
									{/if}
									<button
										type="button"
										class="p-1.5 rounded hover:bg-opacity-10"
										style="color: var(--accent);"
										title="Edit user"
										onclick={() => openEditModal(user)}
									>
										<Pencil class="w-4 h-4" />
									</button>
									{#if user.id !== data.currentUserId}
										<button
											type="button"
											class="p-1.5 rounded hover:bg-opacity-10"
											style="color: #ef4444;"
											title="Delete user"
											onclick={() => openDeleteConfirm(user)}
										>
											<Trash2 class="w-4 h-4" />
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="table-cell text-center py-8" style="color: var(--text-muted);">
								No users found
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<div class="flex items-center justify-between px-4 py-3" style="border-top: 1px solid var(--border-color);">
				<p class="text-sm" style="color: var(--text-muted);">
					Showing {(data.page - 1) * 20 + 1} to {Math.min(data.page * 20, data.total)} of {data.total}
				</p>
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="p-2 rounded disabled:opacity-50"
						style="background-color: var(--bg-tertiary);"
						disabled={data.page <= 1}
						onclick={() => goToPage(data.page - 1)}
					>
						<ChevronLeft class="w-4 h-4" />
					</button>
					{#each Array(data.totalPages) as _, i}
						{#if i + 1 === data.page || i + 1 === 1 || i + 1 === data.totalPages || (i + 1 >= data.page - 1 && i + 1 <= data.page + 1)}
							<button
								type="button"
								class="w-8 h-8 rounded text-sm font-medium"
								style="background-color: {i + 1 === data.page ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {i + 1 === data.page ? 'white' : 'var(--text-secondary)'};"
								onclick={() => goToPage(i + 1)}
							>
								{i + 1}
							</button>
						{:else if i + 1 === data.page - 2 || i + 1 === data.page + 2}
							<span style="color: var(--text-muted);">...</span>
						{/if}
					{/each}
					<button
						type="button"
						class="p-2 rounded disabled:opacity-50"
						style="background-color: var(--bg-tertiary);"
						disabled={data.page >= data.totalPages}
						onclick={() => goToPage(data.page + 1)}
					>
						<ChevronRight class="w-4 h-4" />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Create User Modal -->
{#if showCreateModal}
	<div class="modal-overlay" onclick={() => showCreateModal = false}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Create User</h2>
				<button type="button" class="p-1" onclick={() => showCreateModal = false}>
					<X class="w-5 h-5" style="color: var(--text-muted);" />
				</button>
			</div>

			{#if formErrors.general}
				<div class="mb-4 p-3 rounded" style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444;">
					{formErrors.general}
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); createUser(); }}>
				<div class="grid grid-cols-2 gap-4 mb-4">
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Username *</label>
						<input type="text" class="form-input w-full" bind:value={formData.username} required />
					</div>
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Email *</label>
						<input type="email" class="form-input w-full" bind:value={formData.email} required />
					</div>
				</div>

				<div class="mb-4">
					<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Password *</label>
					<input type="password" class="form-input w-full" bind:value={formData.password} required minlength="8" />
					<p class="text-xs mt-1" style="color: var(--text-muted);">Minimum 8 characters</p>
				</div>

				<div class="grid grid-cols-2 gap-4 mb-4">
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">First Name</label>
						<input type="text" class="form-input w-full" bind:value={formData.firstName} />
					</div>
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Last Name</label>
						<input type="text" class="form-input w-full" bind:value={formData.lastName} />
					</div>
				</div>

				<div class="mb-6">
					<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Role</label>
					<select class="form-input w-full" bind:value={formData.role}>
						{#each data.roles as role}
							{@const info = roleInfo[role]}
							<option value={role}>{info?.label || role}</option>
						{/each}
					</select>
				</div>

				<div class="flex justify-end gap-2">
					<button type="button" class="btn-ghost" onclick={() => showCreateModal = false}>Cancel</button>
					<button type="submit" class="btn-primary flex items-center gap-2" disabled={loading}>
						{#if loading}
							<Loader2 class="w-4 h-4 animate-spin" />
						{/if}
						Create User
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit User Modal -->
{#if showEditModal && selectedUser}
	<div class="modal-overlay" onclick={() => showEditModal = false}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Edit User</h2>
				<button type="button" class="p-1" onclick={() => showEditModal = false}>
					<X class="w-5 h-5" style="color: var(--text-muted);" />
				</button>
			</div>

			{#if formErrors.general}
				<div class="mb-4 p-3 rounded" style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444;">
					{formErrors.general}
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); updateUser(); }}>
				<div class="grid grid-cols-2 gap-4 mb-4">
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Username</label>
						<input type="text" class="form-input w-full" bind:value={formData.username} required />
					</div>
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Email</label>
						<input type="email" class="form-input w-full" bind:value={formData.email} required />
					</div>
				</div>

				<div class="mb-4">
					<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">New Password</label>
					<input type="password" class="form-input w-full" bind:value={formData.password} minlength="8" placeholder="Leave blank to keep current" />
				</div>

				<div class="grid grid-cols-2 gap-4 mb-4">
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">First Name</label>
						<input type="text" class="form-input w-full" bind:value={formData.firstName} />
					</div>
					<div>
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Last Name</label>
						<input type="text" class="form-input w-full" bind:value={formData.lastName} />
					</div>
				</div>

				<div class="mb-6">
					<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Role</label>
					<select
						class="form-input w-full"
						bind:value={formData.role}
						disabled={selectedUser.id === data.currentUserId}
					>
						{#each data.roles as role}
							{@const info = roleInfo[role]}
							<option value={role}>{info?.label || role}</option>
						{/each}
					</select>
					{#if selectedUser.id === data.currentUserId}
						<p class="text-xs mt-1" style="color: var(--text-muted);">You cannot change your own role</p>
					{/if}
				</div>

				<div class="flex justify-end gap-2">
					<button type="button" class="btn-ghost" onclick={() => showEditModal = false}>Cancel</button>
					<button type="submit" class="btn-primary flex items-center gap-2" disabled={loading}>
						{#if loading}
							<Loader2 class="w-4 h-4 animate-spin" />
						{/if}
						Save Changes
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && selectedUser}
	<div class="modal-overlay" onclick={() => showDeleteConfirm = false}>
		<div class="modal-content max-w-md" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-full flex items-center justify-center" style="background-color: rgba(239, 68, 68, 0.1);">
					<Trash2 class="w-5 h-5" style="color: #ef4444;" />
				</div>
				<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Delete User</h2>
			</div>

			<p class="mb-6" style="color: var(--text-secondary);">
				Are you sure you want to delete <strong>{selectedUser.username}</strong>? This action cannot be undone.
			</p>

			<div class="flex justify-end gap-2">
				<button type="button" class="btn-ghost" onclick={() => showDeleteConfirm = false}>Cancel</button>
				<button
					type="button"
					class="px-4 py-2 rounded font-medium text-white flex items-center gap-2"
					style="background-color: #ef4444;"
					disabled={loading}
					onclick={deleteUser}
				>
					{#if loading}
						<Loader2 class="w-4 h-4 animate-spin" />
					{/if}
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.table-header {
		padding: 0.75rem 1rem;
		text-align: left;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.table-row {
		border-bottom: 1px solid var(--border-color);
	}

	.table-row:hover {
		background-color: var(--bg-tertiary);
	}

	.table-cell {
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		padding: 1rem;
	}

	.modal-content {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		padding: 1.5rem;
		width: 100%;
		max-width: 32rem;
		max-height: 90vh;
		overflow-y: auto;
	}

	.form-input {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background-color: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.form-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
