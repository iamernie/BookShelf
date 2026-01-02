<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-svelte';

	let token = $derived($page.url.searchParams.get('token') || '');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let validating = $state(true);
	let tokenValid = $state(false);
	let error = $state('');
	let success = $state(false);

	onMount(async () => {
		if (!token) {
			error = 'No reset token provided';
			validating = false;
			return;
		}

		try {
			const res = await fetch(`/api/auth/reset-password?token=${token}`);
			const data = await res.json();
			tokenValid = data.valid;
			if (!data.valid) {
				error = data.message || 'Invalid or expired reset link';
			}
		} catch {
			error = 'Failed to validate reset link';
		} finally {
			validating = false;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters';
			return;
		}

		loading = true;

		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, password })
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.message || 'Failed to reset password';
				return;
			}

			success = true;
			// Redirect to login after 3 seconds
			setTimeout(() => goto('/login'), 3000);
		} catch {
			error = 'An error occurred. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password - BookShelf</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style="background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);">
	<div class="max-w-md w-full">
		<!-- Logo and Header -->
		<div class="text-center mb-8">
			<div class="flex justify-center mb-4">
				<img
					src="/bookshelflogo.png"
					alt="BookShelf Logo"
					class="w-24 h-24 drop-shadow-lg"
				/>
			</div>
			<h1 class="text-3xl font-bold" style="color: var(--text-primary);">BookShelf</h1>
		</div>

		<!-- Reset Card -->
		<div class="card p-8 shadow-xl">
			{#if validating}
				<div class="text-center py-8">
					<Loader2 class="w-8 h-8 animate-spin mx-auto mb-4" style="color: var(--accent);" />
					<p style="color: var(--text-secondary);">Validating reset link...</p>
				</div>
			{:else if success}
				<div class="text-center py-8">
					<div class="flex justify-center mb-4">
						<div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
							<CheckCircle class="w-8 h-8 text-green-400" />
						</div>
					</div>
					<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">
						Password Reset Successful
					</h2>
					<p class="text-sm mb-4" style="color: var(--text-muted);">
						Your password has been updated. Redirecting to login...
					</p>
					<a href="/login" class="text-sm hover:underline" style="color: var(--accent);">
						Click here if not redirected
					</a>
				</div>
			{:else if !tokenValid}
				<div class="text-center py-8">
					<div class="flex justify-center mb-4">
						<div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
							<AlertCircle class="w-8 h-8 text-red-400" />
						</div>
					</div>
					<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">
						Invalid Reset Link
					</h2>
					<p class="text-sm mb-4" style="color: var(--text-muted);">
						{error || 'This password reset link is invalid or has expired.'}
					</p>
					<a href="/login" class="btn-accent inline-flex items-center">
						Return to Login
					</a>
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-6">
					<div class="text-center mb-6">
						<h2 class="text-xl font-semibold" style="color: var(--text-primary);">Create new password</h2>
						<p class="text-sm mt-1" style="color: var(--text-muted);">
							Enter your new password below
						</p>
					</div>

					{#if error}
						<div class="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
							<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
							<span class="text-red-400 text-sm">{error}</span>
						</div>
					{/if}

					<div class="space-y-4">
						<div>
							<label for="password" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								New Password
							</label>
							<div class="relative">
								<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Lock class="w-5 h-5" style="color: var(--text-muted);" />
								</div>
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									bind:value={password}
									required
									minlength="8"
									placeholder="At least 8 characters"
									class="input pl-10 pr-10"
								/>
								<button
									type="button"
									class="absolute inset-y-0 right-0 pr-3 flex items-center"
									onclick={() => showPassword = !showPassword}
								>
									{#if showPassword}
										<EyeOff class="w-5 h-5" style="color: var(--text-muted);" />
									{:else}
										<Eye class="w-5 h-5" style="color: var(--text-muted);" />
									{/if}
								</button>
							</div>
						</div>

						<div>
							<label for="confirm-password" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Confirm Password
							</label>
							<div class="relative">
								<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Lock class="w-5 h-5" style="color: var(--text-muted);" />
								</div>
								<input
									id="confirm-password"
									type={showPassword ? 'text' : 'password'}
									bind:value={confirmPassword}
									required
									minlength="8"
									placeholder="Confirm your password"
									class="input pl-10"
								/>
							</div>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="btn-accent w-full justify-center py-3 text-base font-medium"
					>
						{#if loading}
							<Loader2 class="w-5 h-5 animate-spin mr-2" />
							Resetting...
						{:else}
							Reset Password
						{/if}
					</button>

					<a
						href="/login"
						class="block w-full text-center text-sm hover:underline"
						style="color: var(--accent);"
					>
						Back to sign in
					</a>
				</form>
			{/if}
		</div>
	</div>
</div>
