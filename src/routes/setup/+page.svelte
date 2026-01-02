<script lang="ts">
	import { goto } from '$app/navigation';
	import { CheckCircle, AlertCircle, Database, User, Settings, ArrowRight, Loader2 } from 'lucide-svelte';

	let { data } = $props();

	// Wizard steps
	type Step = 'welcome' | 'database' | 'admin' | 'complete';
	let currentStep = $state<Step>('welcome');

	// Form data
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let firstName = $state('');
	let lastName = $state('');

	// State
	let loading = $state(false);
	let error = $state('');
	let setupComplete = $state(false);

	// Validation
	let passwordMatch = $derived(password === confirmPassword);
	let passwordValid = $derived(password.length >= 8);
	let emailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
	let usernameValid = $derived(username.length >= 3);

	let formValid = $derived(
		usernameValid && emailValid && passwordValid && passwordMatch
	);

	async function handleSetup() {
		if (!formValid) return;

		loading = true;
		error = '';

		try {
			const res = await fetch('/api/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username,
					email,
					password,
					firstName: firstName || undefined,
					lastName: lastName || undefined
				})
			});

			const result = await res.json();

			if (!res.ok) {
				error = result.message || 'Setup failed';
				return;
			}

			setupComplete = true;
			currentStep = 'complete';
		} catch (err) {
			error = 'An error occurred during setup';
		} finally {
			loading = false;
		}
	}

	function goToLogin() {
		goto('/login');
	}
</script>

<svelte:head>
	<title>Setup - BookShelf</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center py-12 px-4" style="background-color: var(--bg-primary);">
	<div class="max-w-lg w-full">
		<!-- Header -->
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold" style="color: var(--text-primary);">BookShelf</h1>
			<p class="mt-2" style="color: var(--text-secondary);">Welcome to your personal library</p>
		</div>

		<!-- Progress Steps -->
		<div class="flex items-center justify-center gap-2 mb-8">
			{#each ['welcome', 'database', 'admin', 'complete'] as step, i}
				{@const isActive = currentStep === step}
				{@const isPast = ['welcome', 'database', 'admin', 'complete'].indexOf(currentStep) > i}
				<div class="flex items-center gap-2">
					<div
						class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
						class:bg-accent={isActive || isPast}
						class:text-white={isActive || isPast}
						style={!isActive && !isPast ? 'background-color: var(--bg-tertiary); color: var(--text-muted);' : ''}
					>
						{#if isPast}
							<CheckCircle class="w-5 h-5" />
						{:else}
							{i + 1}
						{/if}
					</div>
					{#if i < 3}
						<div
							class="w-8 h-0.5"
							style="background-color: {isPast ? 'var(--accent)' : 'var(--bg-tertiary)'};"
						></div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Step Content -->
		<div class="card p-8">
			{#if currentStep === 'welcome'}
				<div class="text-center">
					<div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background-color: var(--accent);">
						<Settings class="w-8 h-8 text-white" />
					</div>
					<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">Welcome to BookShelf</h2>
					<p class="mb-6" style="color: var(--text-secondary);">
						Let's get your library set up. This wizard will help you create your admin account and configure the essentials.
					</p>

					<div class="space-y-3 text-left mb-6">
						<div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<Database class="w-5 h-5" style="color: var(--accent);" />
							<span style="color: var(--text-primary);">Verify database connection</span>
						</div>
						<div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<User class="w-5 h-5" style="color: var(--accent);" />
							<span style="color: var(--text-primary);">Create admin account</span>
						</div>
						<div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<CheckCircle class="w-5 h-5" style="color: var(--accent);" />
							<span style="color: var(--text-primary);">Initialize default data</span>
						</div>
					</div>

					<button
						class="btn-accent w-full justify-center"
						onclick={() => currentStep = 'database'}
					>
						Get Started
						<ArrowRight class="w-4 h-4 ml-2" />
					</button>
				</div>

			{:else if currentStep === 'database'}
				<div class="text-center">
					<div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background-color: var(--accent);">
						<Database class="w-8 h-8 text-white" />
					</div>
					<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">Database Status</h2>

					<div class="space-y-3 my-6">
						<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<span style="color: var(--text-primary);">Database Connected</span>
							{#if data.status.databaseConnected}
								<CheckCircle class="w-5 h-5 text-green-500" />
							{:else}
								<AlertCircle class="w-5 h-5 text-red-500" />
							{/if}
						</div>
						<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<span style="color: var(--text-primary);">Statuses Table</span>
							{#if data.status.hasStatuses}
								<span class="text-green-500 text-sm">Has data</span>
							{:else}
								<span class="text-yellow-500 text-sm">Will be created</span>
							{/if}
						</div>
						<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<span style="color: var(--text-primary);">Genres Table</span>
							{#if data.status.hasGenres}
								<span class="text-green-500 text-sm">Has data</span>
							{:else}
								<span class="text-yellow-500 text-sm">Will be created</span>
							{/if}
						</div>
						<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<span style="color: var(--text-primary);">Formats Table</span>
							{#if data.status.hasFormats}
								<span class="text-green-500 text-sm">Has data</span>
							{:else}
								<span class="text-yellow-500 text-sm">Will be created</span>
							{/if}
						</div>
					</div>

					{#if data.status.databaseConnected}
						<button
							class="btn-accent w-full justify-center"
							onclick={() => currentStep = 'admin'}
						>
							Continue
							<ArrowRight class="w-4 h-4 ml-2" />
						</button>
					{:else}
						<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-4">
							Database connection failed. Please check your configuration.
						</div>
					{/if}
				</div>

			{:else if currentStep === 'admin'}
				<div>
					<div class="text-center mb-6">
						<div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background-color: var(--accent);">
							<User class="w-8 h-8 text-white" />
						</div>
						<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">Create Admin Account</h2>
						<p style="color: var(--text-secondary);">This will be your primary administrator account</p>
					</div>

					{#if error}
						<div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-4">
							{error}
						</div>
					{/if}

					<form onsubmit={(e) => { e.preventDefault(); handleSetup(); }} class="space-y-4">
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="firstName" class="label">First Name</label>
								<input
									id="firstName"
									type="text"
									bind:value={firstName}
									class="input"
									placeholder="Optional"
								/>
							</div>
							<div>
								<label for="lastName" class="label">Last Name</label>
								<input
									id="lastName"
									type="text"
									bind:value={lastName}
									class="input"
									placeholder="Optional"
								/>
							</div>
						</div>

						<div>
							<label for="username" class="label">Username *</label>
							<input
								id="username"
								type="text"
								bind:value={username}
								required
								class="input"
								class:border-red-500={username && !usernameValid}
								placeholder="admin"
							/>
							{#if username && !usernameValid}
								<p class="text-red-400 text-sm mt-1">Username must be at least 3 characters</p>
							{/if}
						</div>

						<div>
							<label for="email" class="label">Email *</label>
							<input
								id="email"
								type="email"
								bind:value={email}
								required
								class="input"
								class:border-red-500={email && !emailValid}
								placeholder="admin@example.com"
							/>
							{#if email && !emailValid}
								<p class="text-red-400 text-sm mt-1">Please enter a valid email address</p>
							{/if}
						</div>

						<div>
							<label for="password" class="label">Password *</label>
							<input
								id="password"
								type="password"
								bind:value={password}
								required
								class="input"
								class:border-red-500={password && !passwordValid}
								placeholder="Minimum 8 characters"
							/>
							{#if password && !passwordValid}
								<p class="text-red-400 text-sm mt-1">Password must be at least 8 characters</p>
							{/if}
						</div>

						<div>
							<label for="confirmPassword" class="label">Confirm Password *</label>
							<input
								id="confirmPassword"
								type="password"
								bind:value={confirmPassword}
								required
								class="input"
								class:border-red-500={confirmPassword && !passwordMatch}
							/>
							{#if confirmPassword && !passwordMatch}
								<p class="text-red-400 text-sm mt-1">Passwords do not match</p>
							{/if}
						</div>

						<button
							type="submit"
							disabled={loading || !formValid}
							class="btn-accent w-full justify-center mt-6"
						>
							{#if loading}
								<Loader2 class="w-4 h-4 mr-2 animate-spin" />
								Creating Account...
							{:else}
								Complete Setup
								<ArrowRight class="w-4 h-4 ml-2" />
							{/if}
						</button>
					</form>
				</div>

			{:else if currentStep === 'complete'}
				<div class="text-center">
					<div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-green-500">
						<CheckCircle class="w-8 h-8 text-white" />
					</div>
					<h2 class="text-xl font-semibold mb-2" style="color: var(--text-primary);">Setup Complete!</h2>
					<p class="mb-6" style="color: var(--text-secondary);">
						Your BookShelf is ready to use. You can now sign in with your admin account.
					</p>

					<div class="space-y-3 text-left mb-6">
						<div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<CheckCircle class="w-5 h-5 text-green-500" />
							<span style="color: var(--text-primary);">Admin account created</span>
						</div>
						<div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<CheckCircle class="w-5 h-5 text-green-500" />
							<span style="color: var(--text-primary);">Default statuses configured</span>
						</div>
						<div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<CheckCircle class="w-5 h-5 text-green-500" />
							<span style="color: var(--text-primary);">Default genres added</span>
						</div>
						<div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
							<CheckCircle class="w-5 h-5 text-green-500" />
							<span style="color: var(--text-primary);">Book formats initialized</span>
						</div>
					</div>

					<button
						class="btn-accent w-full justify-center"
						onclick={goToLogin}
					>
						Go to Login
						<ArrowRight class="w-4 h-4 ml-2" />
					</button>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<p class="text-center mt-6 text-sm" style="color: var(--text-muted);">
			BookShelf v2.0 - Your personal book library
		</p>
	</div>
</div>
