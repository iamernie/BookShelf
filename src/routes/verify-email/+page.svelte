<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Mail, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-svelte';
	import { APP_CONFIG } from '$lib/config/app';

	let { data } = $props();

	let verifying = $state(true);
	let success = $state(false);
	let error = $state('');
	let resendEmail = $state('');
	let resendLoading = $state(false);
	let resendSuccess = $state('');
	let resendError = $state('');
	let showResendForm = $state(false);

	onMount(async () => {
		if (!data.token) {
			verifying = false;
			showResendForm = true;
			return;
		}

		try {
			const res = await fetch(`/api/auth/verify-email?token=${data.token}`);
			const result = await res.json();

			if (!res.ok) {
				error = result.message || 'Verification failed';
				showResendForm = true;
			} else {
				success = true;
			}
		} catch (err) {
			error = 'An error occurred during verification';
			showResendForm = true;
		} finally {
			verifying = false;
		}
	});

	async function handleResend(e: Event) {
		e.preventDefault();
		resendError = '';
		resendSuccess = '';
		resendLoading = true;

		try {
			const res = await fetch('/api/auth/resend-verification', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: resendEmail })
			});

			const result = await res.json();

			if (!res.ok) {
				resendError = result.message || 'Failed to resend verification email';
			} else {
				resendSuccess = result.message;
			}
		} catch (err) {
			resendError = 'An error occurred. Please try again.';
		} finally {
			resendLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Verify Email - BookShelf</title>
</svelte:head>

<div
	class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
	style="background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);"
>
	<div class="max-w-md w-full">
		<!-- Logo and Header -->
		<div class="text-center mb-8">
			<div class="flex justify-center mb-4">
				<img src="/bookshelflogo.png" alt="BookShelf Logo" class="w-24 h-24 drop-shadow-lg" />
			</div>
			<h1 class="text-3xl font-bold" style="color: var(--text-primary);">BookShelf</h1>
		</div>

		<!-- Verification Card -->
		<div class="card p-8 shadow-xl">
			{#if verifying}
				<!-- Verifying State -->
				<div class="text-center space-y-4">
					<div class="flex justify-center">
						<Loader2 class="w-12 h-12 animate-spin" style="color: var(--accent);" />
					</div>
					<h2 class="text-xl font-semibold" style="color: var(--text-primary);">
						Verifying your email...
					</h2>
					<p class="text-sm" style="color: var(--text-muted);">Please wait a moment.</p>
				</div>
			{:else if success}
				<!-- Success State -->
				<div class="text-center space-y-4">
					<div class="flex justify-center">
						<div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
							<CheckCircle class="w-8 h-8 text-green-400" />
						</div>
					</div>
					<h2 class="text-xl font-semibold" style="color: var(--text-primary);">
						Email Verified!
					</h2>
					<p class="text-sm" style="color: var(--text-muted);">
						Your email has been verified successfully. You can now sign in to your account.
					</p>
					<a href="/login" class="btn-accent inline-flex items-center justify-center mt-4">
						Sign In
					</a>
				</div>
			{:else}
				<!-- Error State -->
				<div class="space-y-6">
					{#if error}
						<div class="text-center space-y-4">
							<div class="flex justify-center">
								<div
									class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center"
								>
									<AlertCircle class="w-8 h-8 text-red-400" />
								</div>
							</div>
							<h2 class="text-xl font-semibold" style="color: var(--text-primary);">
								Verification Failed
							</h2>
							<p class="text-sm text-red-400">{error}</p>
						</div>
					{:else}
						<div class="text-center space-y-4">
							<div class="flex justify-center">
								<div
									class="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center"
								>
									<Mail class="w-8 h-8 text-yellow-400" />
								</div>
							</div>
							<h2 class="text-xl font-semibold" style="color: var(--text-primary);">
								Verify Your Email
							</h2>
							<p class="text-sm" style="color: var(--text-muted);">
								No verification token found. Enter your email to request a new verification link.
							</p>
						</div>
					{/if}

					{#if showResendForm}
						<form onsubmit={handleResend} class="space-y-4">
							<div class="text-center mb-4">
								<p class="text-sm" style="color: var(--text-secondary);">
									Request a new verification email
								</p>
							</div>

							{#if resendError}
								<div
									class="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
								>
									<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
									<span class="text-red-400 text-sm">{resendError}</span>
								</div>
							{/if}

							{#if resendSuccess}
								<div
									class="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30"
								>
									<Mail class="w-5 h-5 text-green-400 flex-shrink-0" />
									<span class="text-green-400 text-sm">{resendSuccess}</span>
								</div>
							{/if}

							{#if !resendSuccess}
								<div>
									<label
										for="email"
										class="block text-sm font-medium mb-2"
										style="color: var(--text-secondary);"
									>
										Email address
									</label>
									<div class="relative">
										<div
											class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
										>
											<Mail class="w-5 h-5" style="color: var(--text-muted);" />
										</div>
										<input
											id="email"
											type="email"
											bind:value={resendEmail}
											required
											autocomplete="email"
											placeholder="you@example.com"
											class="input pl-10"
										/>
									</div>
								</div>

								<button
									type="submit"
									disabled={resendLoading}
									class="btn-accent w-full justify-center py-3"
								>
									{#if resendLoading}
										<Loader2 class="w-5 h-5 animate-spin mr-2" />
										Sending...
									{:else}
										<RefreshCw class="w-5 h-5 mr-2" />
										Resend Verification Email
									{/if}
								</button>
							{/if}
						</form>
					{/if}

					<div class="text-center pt-4">
						<a href="/login" class="text-sm hover:underline" style="color: var(--accent);">
							Back to Sign In
						</a>
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="mt-6 text-center text-xs" style="color: var(--text-muted);">
			<p>{APP_CONFIG.name} {APP_CONFIG.versionString}</p>
			<p>&copy; {APP_CONFIG.copyrightString}</p>
		</div>
	</div>
</div>
