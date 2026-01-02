<script lang="ts">
	import { goto } from '$app/navigation';
	import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User, CheckCircle, Ticket } from 'lucide-svelte';
	import { APP_CONFIG } from '$lib/config/app';

	let { data } = $props();

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let inviteCode = $state('');
	let error = $state('');
	let loading = $state(false);
	let showPassword = $state(false);
	let success = $state(false);
	let successMessage = $state('');

	// Validation states
	let usernameError = $state('');
	let emailError = $state('');
	let passwordError = $state('');
	let confirmPasswordError = $state('');
	let inviteCodeError = $state('');

	function validateUsername() {
		if (!username) {
			usernameError = '';
			return;
		}
		if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
			usernameError = 'Must be 3-30 characters: letters, numbers, _ or -';
		} else {
			usernameError = '';
		}
	}

	function validateEmail() {
		if (!email) {
			emailError = '';
			return;
		}
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			emailError = 'Please enter a valid email address';
		} else {
			emailError = '';
		}
	}

	function validatePassword() {
		if (!password) {
			passwordError = '';
			return;
		}
		if (password.length < 8) {
			passwordError = 'Password must be at least 8 characters';
		} else {
			passwordError = '';
		}
		// Also revalidate confirm password
		validateConfirmPassword();
	}

	function validateConfirmPassword() {
		if (!confirmPassword) {
			confirmPasswordError = '';
			return;
		}
		if (password !== confirmPassword) {
			confirmPasswordError = 'Passwords do not match';
		} else {
			confirmPasswordError = '';
		}
	}

	function validateInviteCode() {
		if (!data.requiresInviteCode) {
			inviteCodeError = '';
			return;
		}
		if (!inviteCode) {
			inviteCodeError = 'Invite code is required';
		} else if (!/^[A-Z0-9-]{8,20}$/i.test(inviteCode)) {
			inviteCodeError = 'Invalid invite code format';
		} else {
			inviteCodeError = '';
		}
	}

	let isFormValid = $derived(
		username &&
			email &&
			password &&
			confirmPassword &&
			!usernameError &&
			!emailError &&
			!passwordError &&
			!confirmPasswordError &&
			!inviteCodeError &&
			password === confirmPassword &&
			(!data.requiresInviteCode || inviteCode)
	);

	async function handleSubmit(e: Event) {
		e.preventDefault();

		// Run all validations
		validateUsername();
		validateEmail();
		validatePassword();
		validateConfirmPassword();
		validateInviteCode();

		if (!isFormValid) {
			error = 'Please fix the errors above';
			return;
		}

		error = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username,
					email,
					password,
					firstName: firstName || undefined,
					lastName: lastName || undefined,
					inviteCode: inviteCode || undefined
				})
			});

			const result = await res.json();

			if (!res.ok) {
				error = result.message || 'Registration failed';
				return;
			}

			success = true;
			successMessage = result.message;

			// If no verification or approval required, redirect to login after a short delay
			if (!result.requiresVerification && !result.requiresApproval) {
				setTimeout(() => {
					goto('/login');
				}, 2000);
			}
		} catch (err) {
			error = 'An error occurred. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign Up - BookShelf</title>
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
			<p class="mt-2 text-sm" style="color: var(--text-secondary);">
				Your personal library, organized
			</p>
		</div>

		<!-- Sign Up Card -->
		<div class="card p-8 shadow-xl">
			{#if success}
				<!-- Success State -->
				<div class="text-center space-y-4">
					<div class="flex justify-center">
						<div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
							<CheckCircle class="w-8 h-8 text-green-400" />
						</div>
					</div>
					<h2 class="text-xl font-semibold" style="color: var(--text-primary);">Account Created!</h2>
					<p class="text-sm" style="color: var(--text-muted);">{successMessage}</p>
					{#if data.requiresVerification}
						<p class="text-sm" style="color: var(--text-secondary);">
							Check your inbox at <strong>{email}</strong> for a verification link.
						</p>
					{/if}
					<a href="/login" class="btn-accent inline-flex items-center justify-center mt-4">
						Go to Sign In
					</a>
				</div>
			{:else}
				<!-- Sign Up Form -->
				<form onsubmit={handleSubmit} class="space-y-5">
					<div class="text-center mb-6">
						<h2 class="text-xl font-semibold" style="color: var(--text-primary);">
							Create an account
						</h2>
						<p class="text-sm mt-1" style="color: var(--text-muted);">
							Join BookShelf to track your reading
						</p>
					</div>

					{#if error}
						<div
							class="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
						>
							<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
							<span class="text-red-400 text-sm">{error}</span>
						</div>
					{/if}

					{#if data.requiresVerification && !data.emailConfigured}
						<div
							class="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
						>
							<AlertCircle class="w-5 h-5 text-yellow-400 flex-shrink-0" />
							<span class="text-yellow-400 text-sm"
								>Email verification is required but email is not configured. Contact an
								administrator.</span
							>
						</div>
					{/if}

					<div class="space-y-4">
						<!-- Username -->
						<div>
							<label
								for="username"
								class="block text-sm font-medium mb-2"
								style="color: var(--text-secondary);"
							>
								Username <span class="text-red-400">*</span>
							</label>
							<div class="relative">
								<div
									class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
								>
									<User class="w-5 h-5" style="color: var(--text-muted);" />
								</div>
								<input
									id="username"
									type="text"
									bind:value={username}
									onblur={validateUsername}
									required
									autocomplete="username"
									placeholder="Choose a username"
									class="input pl-10"
									class:border-red-500={usernameError}
								/>
							</div>
							{#if usernameError}
								<p class="text-red-400 text-xs mt-1">{usernameError}</p>
							{/if}
						</div>

						<!-- Email -->
						<div>
							<label
								for="email"
								class="block text-sm font-medium mb-2"
								style="color: var(--text-secondary);"
							>
								Email address <span class="text-red-400">*</span>
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
									bind:value={email}
									onblur={validateEmail}
									required
									autocomplete="email"
									placeholder="you@example.com"
									class="input pl-10"
									class:border-red-500={emailError}
								/>
							</div>
							{#if emailError}
								<p class="text-red-400 text-xs mt-1">{emailError}</p>
							{/if}
						</div>

						<!-- Name Fields (Optional) -->
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label
									for="firstName"
									class="block text-sm font-medium mb-2"
									style="color: var(--text-secondary);"
								>
									First name
								</label>
								<input
									id="firstName"
									type="text"
									bind:value={firstName}
									autocomplete="given-name"
									placeholder="First"
									class="input"
								/>
							</div>
							<div>
								<label
									for="lastName"
									class="block text-sm font-medium mb-2"
									style="color: var(--text-secondary);"
								>
									Last name
								</label>
								<input
									id="lastName"
									type="text"
									bind:value={lastName}
									autocomplete="family-name"
									placeholder="Last"
									class="input"
								/>
							</div>
						</div>

						<!-- Password -->
						<div>
							<label
								for="password"
								class="block text-sm font-medium mb-2"
								style="color: var(--text-secondary);"
							>
								Password <span class="text-red-400">*</span>
							</label>
							<div class="relative">
								<div
									class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
								>
									<Lock class="w-5 h-5" style="color: var(--text-muted);" />
								</div>
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									bind:value={password}
									onblur={validatePassword}
									required
									autocomplete="new-password"
									placeholder="Create a password"
									class="input pl-10 pr-10"
									class:border-red-500={passwordError}
								/>
								<button
									type="button"
									class="absolute inset-y-0 right-0 pr-3 flex items-center"
									onclick={() => (showPassword = !showPassword)}
								>
									{#if showPassword}
										<EyeOff class="w-5 h-5" style="color: var(--text-muted);" />
									{:else}
										<Eye class="w-5 h-5" style="color: var(--text-muted);" />
									{/if}
								</button>
							</div>
							{#if passwordError}
								<p class="text-red-400 text-xs mt-1">{passwordError}</p>
							{:else}
								<p class="text-xs mt-1" style="color: var(--text-muted);">
									Must be at least 8 characters
								</p>
							{/if}
						</div>

						<!-- Confirm Password -->
						<div>
							<label
								for="confirmPassword"
								class="block text-sm font-medium mb-2"
								style="color: var(--text-secondary);"
							>
								Confirm password <span class="text-red-400">*</span>
							</label>
							<div class="relative">
								<div
									class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
								>
									<Lock class="w-5 h-5" style="color: var(--text-muted);" />
								</div>
								<input
									id="confirmPassword"
									type={showPassword ? 'text' : 'password'}
									bind:value={confirmPassword}
									onblur={validateConfirmPassword}
									required
									autocomplete="new-password"
									placeholder="Confirm your password"
									class="input pl-10"
									class:border-red-500={confirmPasswordError}
								/>
							</div>
							{#if confirmPasswordError}
								<p class="text-red-400 text-xs mt-1">{confirmPasswordError}</p>
							{/if}
						</div>

						<!-- Invite Code (conditional) -->
						{#if data.requiresInviteCode}
							<div>
								<label
									for="inviteCode"
									class="block text-sm font-medium mb-2"
									style="color: var(--text-secondary);"
								>
									Invite Code <span class="text-red-400">*</span>
								</label>
								<div class="relative">
									<div
										class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
									>
										<Ticket class="w-5 h-5" style="color: var(--text-muted);" />
									</div>
									<input
										id="inviteCode"
										type="text"
										bind:value={inviteCode}
										onblur={validateInviteCode}
										required
										placeholder="Enter your invite code"
										class="input pl-10 uppercase"
										class:border-red-500={inviteCodeError}
									/>
								</div>
								{#if inviteCodeError}
									<p class="text-red-400 text-xs mt-1">{inviteCodeError}</p>
								{:else}
									<p class="text-xs mt-1" style="color: var(--text-muted);">
										You need an invite code to register
									</p>
								{/if}
							</div>
						{/if}
					</div>

					{#if data.requiresApproval}
						<div
							class="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30"
						>
							<AlertCircle class="w-5 h-5 text-blue-400 flex-shrink-0" />
							<span class="text-blue-400 text-sm"
								>Your registration will need to be approved by an administrator before you can sign
								in.</span
							>
						</div>
					{/if}

					<button
						type="submit"
						disabled={loading || !isFormValid}
						class="btn-accent w-full justify-center py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if loading}
							<Loader2 class="w-5 h-5 animate-spin mr-2" />
							Creating account...
						{:else}
							Create account
						{/if}
					</button>

					<div class="text-center">
						<p class="text-sm" style="color: var(--text-muted);">
							Already have an account?
							<a href="/login" class="hover:underline" style="color: var(--accent);">
								Sign in
							</a>
						</p>
					</div>
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
