<script lang="ts">
	import { enhance } from '$app/forms';
	import { Mail, Lock, User, AlertCircle, Loader2, Link, UserPlus, ArrowLeft } from 'lucide-svelte';
	import { APP_CONFIG } from '$lib/config/app';

	let { data, form } = $props();

	let mode = $state<'choose' | 'link' | 'create'>(data.hasExistingAccount ? 'choose' : (data.signupAllowed ? 'choose' : 'link'));
	let loading = $state(false);

	function setMode(newMode: 'choose' | 'link' | 'create') {
		mode = newMode;
	}
</script>

<svelte:head>
	<title>Complete Sign In - BookShelf</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style="background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);">
	<div class="max-w-md w-full">
		<!-- Logo and Header -->
		<div class="text-center mb-8">
			<div class="flex justify-center mb-4">
				<img
					src="/bookshelflogo.png"
					alt="BookShelf Logo"
					class="w-20 h-20 drop-shadow-lg"
				/>
			</div>
			<h1 class="text-2xl font-bold" style="color: var(--text-primary);">Complete Sign In</h1>
			<p class="mt-2 text-sm" style="color: var(--text-secondary);">
				Signing in with {data.providerName}
			</p>
		</div>

		<!-- Card -->
		<div class="card p-8 shadow-xl">
			{#if mode === 'choose'}
				<!-- Choice Screen -->
				<div class="text-center mb-6">
					<p class="text-sm" style="color: var(--text-muted);">
						{#if data.email}
							Welcome, <strong style="color: var(--text-primary);">{data.email}</strong>
						{:else}
							Welcome!
						{/if}
					</p>
				</div>

				<div class="space-y-4">
					{#if data.hasExistingAccount}
						<button
							type="button"
							class="w-full flex items-center gap-3 p-4 rounded-lg border transition-colors"
							style="background: var(--bg-tertiary); border-color: var(--border-color);"
							onclick={() => setMode('link')}
						>
							<div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: var(--accent);">
								<Link class="w-5 h-5 text-white" />
							</div>
							<div class="text-left flex-1">
								<p class="font-medium" style="color: var(--text-primary);">Link to existing account</p>
								<p class="text-sm" style="color: var(--text-muted);">
									Connect to {data.existingUsername}
								</p>
							</div>
						</button>
					{/if}

					{#if data.signupAllowed}
						<button
							type="button"
							class="w-full flex items-center gap-3 p-4 rounded-lg border transition-colors"
							style="background: var(--bg-tertiary); border-color: var(--border-color);"
							onclick={() => setMode('create')}
						>
							<div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: var(--bg-secondary); border: 2px dashed var(--border-color);">
								<UserPlus class="w-5 h-5" style="color: var(--text-muted);" />
							</div>
							<div class="text-left flex-1">
								<p class="font-medium" style="color: var(--text-primary);">Create new account</p>
								<p class="text-sm" style="color: var(--text-muted);">
									Set up a new BookShelf account
									{#if data.requireApproval}
										(requires approval)
									{/if}
								</p>
							</div>
						</button>
					{/if}
				</div>

				<form method="POST" action="?/cancel" class="mt-6">
					<button
						type="submit"
						class="w-full text-center text-sm hover:underline"
						style="color: var(--text-muted);"
					>
						Cancel and return to login
					</button>
				</form>
			{:else if mode === 'link'}
				<!-- Link Account Form -->
				<form
					method="POST"
					action="?/link"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-6"
				>
					<div class="flex items-center gap-2 mb-4">
						<button
							type="button"
							class="p-1 rounded hover:bg-black/10"
							onclick={() => setMode('choose')}
						>
							<ArrowLeft class="w-4 h-4" style="color: var(--text-muted);" />
						</button>
						<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Link Account</h2>
					</div>

					{#if form?.linkError}
						<div class="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
							<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
							<span class="text-red-400 text-sm">{form.linkError}</span>
						</div>
					{/if}

					<p class="text-sm" style="color: var(--text-muted);">
						Enter your password to link <strong>{data.email}</strong> with {data.providerName}.
					</p>

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
								name="password"
								type="password"
								required
								autocomplete="current-password"
								placeholder="Enter your password"
								class="input pl-10"
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="btn-accent w-full justify-center py-3 text-base font-medium"
					>
						{#if loading}
							<Loader2 class="w-5 h-5 animate-spin mr-2" />
							Linking...
						{:else}
							Link Account
						{/if}
					</button>
				</form>
			{:else if mode === 'create'}
				<!-- Create Account Form -->
				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-6"
				>
					<div class="flex items-center gap-2 mb-4">
						<button
							type="button"
							class="p-1 rounded hover:bg-black/10"
							onclick={() => setMode('choose')}
						>
							<ArrowLeft class="w-4 h-4" style="color: var(--text-muted);" />
						</button>
						<h2 class="text-lg font-semibold" style="color: var(--text-primary);">Create Account</h2>
					</div>

					{#if form?.createError}
						<div class="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
							<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0" />
							<span class="text-red-400 text-sm">{form.createError}</span>
						</div>
					{/if}

					{#if data.requireApproval}
						<div class="flex items-center gap-3 p-3 rounded-lg" style="background: rgba(234, 179, 8, 0.1); color: #eab308;">
							<AlertCircle class="w-5 h-5 flex-shrink-0" />
							<span class="text-sm">Your account will require admin approval before you can sign in.</span>
						</div>
					{/if}

					{#if data.email}
						<div class="p-3 rounded-lg" style="background: var(--bg-tertiary);">
							<p class="text-xs mb-1" style="color: var(--text-muted);">Email from {data.providerName}</p>
							<p class="font-medium" style="color: var(--text-primary);">{data.email}</p>
						</div>
					{/if}

					<div>
						<label for="username" class="block text-sm font-medium mb-2" style="color: var(--text-secondary);">
							Username
						</label>
						<div class="relative">
							<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<User class="w-5 h-5" style="color: var(--text-muted);" />
							</div>
							<input
								id="username"
								name="username"
								type="text"
								required
								minlength="3"
								placeholder="Choose a username"
								class="input pl-10"
								value={data.name?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || ''}
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
								name="password"
								type="password"
								required
								minlength="8"
								placeholder="Create a password (min 8 chars)"
								class="input pl-10"
							/>
						</div>
						<p class="text-xs mt-1" style="color: var(--text-muted);">
							This password lets you sign in even if {data.providerName} is unavailable.
						</p>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="btn-accent w-full justify-center py-3 text-base font-medium"
					>
						{#if loading}
							<Loader2 class="w-5 h-5 animate-spin mr-2" />
							Creating...
						{:else}
							Create Account
						{/if}
					</button>
				</form>
			{/if}
		</div>

		<!-- Footer -->
		<div class="mt-6 text-center text-xs" style="color: var(--text-muted);">
			<p>{APP_CONFIG.name} {APP_CONFIG.versionString}</p>
		</div>
	</div>
</div>
