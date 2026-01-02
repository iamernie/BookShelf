<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		User,
		Mail,
		Calendar,
		Shield,
		Key,
		Save,
		Loader2,
		Check,
		Settings,
		ChevronRight
	} from 'lucide-svelte';
	import { toasts } from '$lib/stores/toast';

	let { data } = $props();

	// Profile form
	let profileData = $state({
		username: data.user.username,
		email: data.user.email,
		firstName: data.user.firstName || '',
		lastName: data.user.lastName || ''
	});
	let profileLoading = $state(false);
	let profileSuccess = $state(false);

	// Password form
	let passwordData = $state({
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	});
	let passwordLoading = $state(false);
	let passwordError = $state('');

	async function saveProfile() {
		profileLoading = true;
		profileSuccess = false;

		try {
			const res = await fetch('/api/account', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(profileData)
			});

			if (res.ok) {
				profileSuccess = true;
				toasts.success('Profile updated');
				invalidateAll();
				setTimeout(() => profileSuccess = false, 2000);
			} else {
				const result = await res.json();
				toasts.error(result.message || 'Failed to update profile');
			}
		} catch {
			toasts.error('An error occurred');
		} finally {
			profileLoading = false;
		}
	}

	async function changePassword() {
		passwordError = '';

		if (passwordData.newPassword !== passwordData.confirmPassword) {
			passwordError = 'New passwords do not match';
			return;
		}

		if (passwordData.newPassword.length < 8) {
			passwordError = 'Password must be at least 8 characters';
			return;
		}

		passwordLoading = true;

		try {
			const res = await fetch('/api/account/password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					currentPassword: passwordData.currentPassword,
					newPassword: passwordData.newPassword
				})
			});

			if (res.ok) {
				toasts.success('Password changed successfully');
				passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
			} else {
				const result = await res.json();
				passwordError = result.message || 'Failed to change password';
			}
		} catch {
			passwordError = 'An error occurred';
		} finally {
			passwordLoading = false;
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	const roleLabels: Record<string, string> = {
		admin: 'Administrator',
		librarian: 'Librarian',
		member: 'Member',
		viewer: 'Viewer',
		guest: 'Guest'
	};
</script>

<svelte:head>
	<title>My Account | BookShelf</title>
</svelte:head>

<div class="container mx-auto px-4 py-6 max-w-4xl">
	<!-- Header -->
	<div class="flex items-center gap-3 mb-6">
		<User class="w-6 h-6" style="color: var(--accent);" />
		<h1 class="text-2xl font-bold" style="color: var(--text-primary);">My Account</h1>
	</div>

	<!-- Quick Nav -->
	<div class="flex gap-2 mb-6">
		<a href="/account" class="px-4 py-2 rounded-lg font-medium" style="background-color: var(--accent); color: white;">
			Profile
		</a>
		<a href="/account/settings" class="px-4 py-2 rounded-lg font-medium" style="background-color: var(--bg-tertiary); color: var(--text-secondary);">
			Settings
		</a>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Left: User Info Card -->
		<div class="lg:col-span-1">
			<div class="card p-6">
				<!-- Avatar placeholder -->
				<div class="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold" style="background-color: var(--accent); color: white;">
					{(data.user.firstName?.[0] || data.user.username[0]).toUpperCase()}
				</div>

				<h2 class="text-lg font-semibold text-center mb-1" style="color: var(--text-primary);">
					{data.user.firstName || ''} {data.user.lastName || ''}
					{#if !data.user.firstName && !data.user.lastName}
						{data.user.username}
					{/if}
				</h2>

				<p class="text-sm text-center mb-4" style="color: var(--text-muted);">@{data.user.username}</p>

				<div class="space-y-3 pt-4" style="border-top: 1px solid var(--border-color);">
					<div class="flex items-center gap-3">
						<Mail class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-secondary);">{data.user.email}</span>
					</div>
					<div class="flex items-center gap-3">
						<Shield class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-secondary);">{roleLabels[data.user.role] || data.user.role}</span>
					</div>
					<div class="flex items-center gap-3">
						<Calendar class="w-4 h-4" style="color: var(--text-muted);" />
						<span class="text-sm" style="color: var(--text-secondary);">Joined {formatDate(data.user.createdAt)}</span>
					</div>
				</div>

				<!-- Settings Link -->
				<a
					href="/account/settings"
					class="mt-6 flex items-center justify-between p-3 rounded-lg transition-colors"
					style="background-color: var(--bg-tertiary);"
				>
					<div class="flex items-center gap-2">
						<Settings class="w-4 h-4" style="color: var(--accent);" />
						<span class="text-sm font-medium" style="color: var(--text-primary);">Preferences</span>
					</div>
					<ChevronRight class="w-4 h-4" style="color: var(--text-muted);" />
				</a>
			</div>
		</div>

		<!-- Right: Forms -->
		<div class="lg:col-span-2 space-y-6">
			<!-- Profile Form -->
			<div class="card p-6">
				<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Edit Profile</h3>

				<form onsubmit={(e) => { e.preventDefault(); saveProfile(); }}>
					<div class="grid grid-cols-2 gap-4 mb-4">
						<div>
							<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">First Name</label>
							<input type="text" class="form-input w-full" bind:value={profileData.firstName} />
						</div>
						<div>
							<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Last Name</label>
							<input type="text" class="form-input w-full" bind:value={profileData.lastName} />
						</div>
					</div>

					<div class="mb-4">
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Username</label>
						<input type="text" class="form-input w-full" bind:value={profileData.username} required />
					</div>

					<div class="mb-6">
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Email</label>
						<input type="email" class="form-input w-full" bind:value={profileData.email} required />
					</div>

					<button type="submit" class="btn-primary flex items-center gap-2" disabled={profileLoading}>
						{#if profileLoading}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else if profileSuccess}
							<Check class="w-4 h-4" />
						{:else}
							<Save class="w-4 h-4" />
						{/if}
						{profileSuccess ? 'Saved!' : 'Save Changes'}
					</button>
				</form>
			</div>

			<!-- Password Form -->
			<div class="card p-6">
				<h3 class="text-lg font-semibold mb-4 flex items-center gap-2" style="color: var(--text-primary);">
					<Key class="w-5 h-5" />
					Change Password
				</h3>

				{#if passwordError}
					<div class="mb-4 p-3 rounded" style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444;">
						{passwordError}
					</div>
				{/if}

				<form onsubmit={(e) => { e.preventDefault(); changePassword(); }}>
					<div class="mb-4">
						<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Current Password</label>
						<input type="password" class="form-input w-full" bind:value={passwordData.currentPassword} required />
					</div>

					<div class="grid grid-cols-2 gap-4 mb-6">
						<div>
							<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">New Password</label>
							<input type="password" class="form-input w-full" bind:value={passwordData.newPassword} required minlength="8" />
						</div>
						<div>
							<label class="block text-sm font-medium mb-1" style="color: var(--text-secondary);">Confirm New Password</label>
							<input type="password" class="form-input w-full" bind:value={passwordData.confirmPassword} required />
						</div>
					</div>

					<button type="submit" class="btn-primary flex items-center gap-2" disabled={passwordLoading}>
						{#if passwordLoading}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							<Key class="w-4 h-4" />
						{/if}
						Change Password
					</button>
				</form>
			</div>
		</div>
	</div>
</div>

<style>
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
</style>
