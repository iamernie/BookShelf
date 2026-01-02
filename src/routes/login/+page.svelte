<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-svelte';
	import { APP_CONFIG } from '$lib/config/app';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let showPassword = $state(false);
	let showForgotPassword = $state(false);
	let resetEmail = $state('');
	let resetSent = $state(false);
	let resetLoading = $state(false);
	let resetError = $state('');
	let resetSuccess = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			if (!res.ok) {
				const data = await res.json();
				error = data.message || 'Login failed';
				return;
			}

			// Invalidate all data to reload user session, then redirect
			await invalidateAll();
			goto('/');
		} catch (err) {
			error = 'An error occurred. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleForgotPassword(e: Event) {
		e.preventDefault();
		resetError = '';
		resetSuccess = '';
		resetLoading = true;

		try {
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: resetEmail })
			});

			const data = await res.json();

			if (!res.ok) {
				resetError = data.message || 'Failed to send reset email';
				return;
			}

			resetSuccess = 'If an account exists with that email, you will receive a password reset link.';
			resetSent = true;
		} catch (err) {
			resetError = 'An error occurred. Please try again.';
		} finally {
			resetLoading = false;
		}
	}

	function toggleForgotPassword() {
		showForgotPassword = !showForgotPassword;
		resetError = '';
		resetSuccess = '';
		resetSent = false;
	}
</script>

<svelte:head>
	<title>Login - BookShelf</title>
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
			<p class="mt-2 text-sm" style="color: var(--text-secondary);">
				Your personal library, organized
			</p>
		</div>

		<!-- Login Card -->
		<div class="card p-8 shadow-xl">
			{#if !showForgotPassword}
				<!-- Login Form -->
				<form onsubmit={handleSubmit} class="space-y-6">
					<div class="text-center mb-6">
						<h2 class="text-xl font-semibold" style="color: var(--text-primary);">Welcome back</h2>
						<p class="text-sm mt-1" style="color: var(--text-muted);">Sign in to continue to your library</p>
					</div>

					{#if error || data.oidcError}
						<div class="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
							<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
							<span class="text-red-400 text-sm">{error || data.oidcError}</span>
						</div>
					{/if}

					<div class="space-y-4">
						<div>
							<label for="email" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Email address
							</label>
							<div class="relative">
								<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Mail class="w-5 h-5" style="color: var(--text-muted);" />
								</div>
								<input
									id="email"
									type="email"
									bind:value={email}
									required
									autocomplete="email"
									placeholder="you@example.com"
									class="input pl-10"
								/>
							</div>
						</div>

						<div>
							<label for="password" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Password
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
									autocomplete="current-password"
									placeholder="Enter your password"
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
					</div>

					<div class="flex items-center justify-end">
						<button
							type="button"
							class="text-sm hover:underline"
							style="color: var(--accent);"
							onclick={toggleForgotPassword}
						>
							Forgot password?
						</button>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="btn-accent w-full justify-center py-3 text-base font-medium"
					>
						{#if loading}
							<Loader2 class="w-5 h-5 animate-spin mr-2" />
							Signing in...
						{:else}
							Sign in
						{/if}
					</button>

					{#if data.oidcProviders && data.oidcProviders.length > 0}
						<div class="relative my-6">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t" style="border-color: var(--border-color);"></div>
							</div>
							<div class="relative flex justify-center text-sm">
								<span class="px-2" style="background: var(--bg-secondary); color: var(--text-muted);">
									or continue with
								</span>
							</div>
						</div>

						<div class="space-y-3">
							{#each data.oidcProviders as provider}
								<a
									href="/auth/oidc/{provider.slug}"
									class="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-lg border font-medium transition-colors hover:opacity-90"
									style="background-color: {provider.buttonColor || 'var(--bg-tertiary)'};
									       border-color: {provider.buttonColor || 'var(--border-color)'};
									       color: {provider.buttonColor ? 'white' : 'var(--text-primary)'};"
								>
									{#if provider.iconUrl}
										<img src={provider.iconUrl} alt="" class="w-5 h-5" />
									{/if}
									Sign in with {provider.name}
								</a>
							{/each}
						</div>
					{/if}

					{#if data.signupEnabled}
						<div class="text-center">
							<p class="text-sm" style="color: var(--text-muted);">
								Don't have an account?
								<a href="/signup" class="hover:underline" style="color: var(--accent);">
									Sign up
								</a>
							</p>
						</div>
					{/if}
				</form>
			{:else}
				<!-- Forgot Password Form -->
				<form onsubmit={handleForgotPassword} class="space-y-6">
					<div class="text-center mb-6">
						<h2 class="text-xl font-semibold" style="color: var(--text-primary);">Reset password</h2>
						<p class="text-sm mt-1" style="color: var(--text-muted);">
							Enter your email and we'll send you a reset link
						</p>
					</div>

					{#if resetError}
						<div class="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
							<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
							<span class="text-red-400 text-sm">{resetError}</span>
						</div>
					{/if}

					{#if resetSuccess}
						<div class="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
							<Mail class="w-5 h-5 text-green-400 flex-shrink-0" />
							<span class="text-green-400 text-sm">{resetSuccess}</span>
						</div>
					{/if}

					{#if !resetSent}
						<div>
							<label for="reset-email" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
								Email address
							</label>
							<div class="relative">
								<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Mail class="w-5 h-5" style="color: var(--text-muted);" />
								</div>
								<input
									id="reset-email"
									type="email"
									bind:value={resetEmail}
									required
									autocomplete="email"
									placeholder="you@example.com"
									class="input pl-10"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={resetLoading}
							class="btn-accent w-full justify-center py-3 text-base font-medium"
						>
							{#if resetLoading}
								<Loader2 class="w-5 h-5 animate-spin mr-2" />
								Sending...
							{:else}
								Send reset link
							{/if}
						</button>
					{/if}

					<button
						type="button"
						class="w-full text-center text-sm hover:underline"
						style="color: var(--accent);"
						onclick={toggleForgotPassword}
					>
						Back to sign in
					</button>
				</form>
			{/if}
		</div>

		<!-- Footer -->
		<div class="mt-6 text-center text-xs" style="color: var(--text-muted);">
			<p>{APP_CONFIG.name} {APP_CONFIG.versionString}</p>
			<p>&copy; {APP_CONFIG.copyrightString}</p>
		</div>
	</div>
</div>
