<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { CheckCircle, Circle, Loader2, AlertCircle, Database, Shield } from 'lucide-svelte';
	import { APP_CONFIG } from '$lib/config/app';

	let { data } = $props();

	interface MigrationStatus {
		inProgress: boolean;
		completed: boolean;
		currentStep: string;
		steps: string[];
		completedSteps: string[];
		error: string | null;
		backupPath: string | null;
		startTime: number | null;
		endTime: number | null;
	}

	let status = $state<MigrationStatus>(data.migrationStatus);
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		// Poll for updates while migration is in progress
		if (status.inProgress) {
			pollInterval = setInterval(async () => {
				try {
					const response = await fetch('/api/system/migration-status');
					if (response.ok) {
						status = await response.json();
						if (!status.inProgress) {
							if (pollInterval) clearInterval(pollInterval);
							// Redirect to home after a short delay
							if (!status.error) {
								setTimeout(() => {
									window.location.href = '/';
								}, 2000);
							}
						}
					}
				} catch {
					// Ignore errors during polling
				}
			}, 500);
		}
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});

	function getStepStatus(step: string): 'completed' | 'current' | 'pending' {
		if (status.completedSteps.includes(step)) return 'completed';
		if (status.currentStep.includes(step.split(' ')[0])) return 'current';
		return 'pending';
	}

	function formatDuration(start: number | null, end: number | null): string {
		if (!start) return '';
		const endTime = end || Date.now();
		const ms = endTime - start;
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<svelte:head>
	<title>Database Upgrade - {APP_CONFIG.name}</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4" style="background-color: var(--bg-primary);">
	<div class="w-full max-w-lg">
		<!-- Logo/Header -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style="background-color: var(--accent);">
				<Database class="w-8 h-8 text-white" />
			</div>
			<h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary);">
				Database Upgrade
			</h1>
			<p class="text-sm" style="color: var(--text-muted);">
				{APP_CONFIG.name} {APP_CONFIG.versionString}
			</p>
		</div>

		<!-- Main Card -->
		<div class="rounded-xl shadow-lg p-6" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color);">
			{#if status.error}
				<!-- Error State -->
				<div class="text-center">
					<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
						<AlertCircle class="w-6 h-6 text-red-600" />
					</div>
					<h2 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
						Upgrade Failed
					</h2>
					<p class="text-sm mb-4" style="color: var(--text-muted);">
						{status.error}
					</p>
					{#if status.backupPath}
						<div class="p-3 rounded-lg text-sm text-left" style="background-color: var(--bg-tertiary);">
							<div class="flex items-center gap-2 mb-1">
								<Shield class="w-4 h-4 text-green-500" />
								<span class="font-medium" style="color: var(--text-primary);">Backup Available</span>
							</div>
							<code class="text-xs break-all" style="color: var(--text-muted);">
								{status.backupPath}
							</code>
						</div>
					{/if}
				</div>
			{:else if status.completed && !status.inProgress}
				<!-- Completed State -->
				<div class="text-center">
					<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
						<CheckCircle class="w-6 h-6 text-green-600" />
					</div>
					<h2 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
						Upgrade Complete
					</h2>
					<p class="text-sm mb-4" style="color: var(--text-muted);">
						Database has been successfully upgraded.
						{#if status.startTime && status.endTime}
							<span class="block mt-1">
								Completed in {formatDuration(status.startTime, status.endTime)}
							</span>
						{/if}
					</p>
					<p class="text-sm" style="color: var(--text-muted);">
						Redirecting to home...
					</p>
				</div>
			{:else}
				<!-- In Progress State -->
				<div class="mb-6">
					<div class="flex items-center gap-3 mb-4">
						<Loader2 class="w-5 h-5 animate-spin" style="color: var(--accent);" />
						<span class="font-medium" style="color: var(--text-primary);">
							{status.currentStep || 'Initializing...'}
						</span>
					</div>

					{#if status.startTime}
						<p class="text-xs mb-4" style="color: var(--text-muted);">
							Elapsed: {formatDuration(status.startTime, null)}
						</p>
					{/if}
				</div>

				<!-- Steps List -->
				<div class="space-y-3">
					{#each status.steps as step}
						{@const stepStatus = getStepStatus(step)}
						<div class="flex items-center gap-3">
							{#if stepStatus === 'completed'}
								<CheckCircle class="w-5 h-5 text-green-500 flex-shrink-0" />
							{:else if stepStatus === 'current'}
								<Loader2 class="w-5 h-5 animate-spin flex-shrink-0" style="color: var(--accent);" />
							{:else}
								<Circle class="w-5 h-5 flex-shrink-0" style="color: var(--text-muted);" />
							{/if}
							<span
								class="text-sm"
								style="color: {stepStatus === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)'};"
							>
								{step}
							</span>
						</div>
					{/each}
				</div>

				<!-- Backup Notice -->
				{#if status.backupPath}
					<div class="mt-6 p-3 rounded-lg text-sm" style="background-color: var(--bg-tertiary);">
						<div class="flex items-center gap-2 mb-1">
							<Shield class="w-4 h-4 text-green-500" />
							<span class="font-medium" style="color: var(--text-primary);">Backup Created</span>
						</div>
						<code class="text-xs break-all" style="color: var(--text-muted);">
							{status.backupPath}
						</code>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Footer -->
		<p class="text-center text-xs mt-6" style="color: var(--text-muted);">
			Do not close this window or refresh the page during the upgrade.
		</p>
	</div>
</div>
