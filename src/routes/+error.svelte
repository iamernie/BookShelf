<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Home,
		ArrowLeft,
		RefreshCw,
		AlertTriangle,
		Lock,
		Ban,
		Server,
		Clock,
		XCircle,
		BookOpen,
		Search,
		Users,
		Library,
		BarChart2,
		Bug
	} from 'lucide-svelte';

	// Get error info from page store
	let status = $derived($page.status);
	let message = $derived($page.error?.message || 'An unexpected error occurred');

	// Determine icon and title based on status code
	let errorConfig = $derived.by(() => {
		const isClientError = status >= 400 && status < 500;

		if (status === 400) {
			return { icon: XCircle, title: 'Bad Request', colorClass: 'warning' };
		} else if (status === 401) {
			return { icon: Lock, title: 'Unauthorized', colorClass: 'warning' };
		} else if (status === 403) {
			return { icon: Ban, title: 'Access Denied', colorClass: 'warning' };
		} else if (status === 404) {
			return { icon: BookOpen, title: 'Page Not Found', colorClass: 'primary' };
		} else if (status === 409) {
			return { icon: AlertTriangle, title: 'Conflict', colorClass: 'warning' };
		} else if (status === 429) {
			return { icon: Clock, title: 'Too Many Requests', colorClass: 'warning' };
		} else {
			return { icon: Server, title: 'Server Error', colorClass: 'error' };
		}
	});

	function goBack() {
		history.back();
	}

	function tryAgain() {
		location.reload();
	}
</script>

<svelte:head>
	<title>{status} - {errorConfig.title} | BookShelf</title>
</svelte:head>

<div class="error-page">
	<div class="error-container">
		<!-- Error Code -->
		<div class="error-code {errorConfig.colorClass}">{status}</div>

		<!-- Icon -->
		<div class="error-icon {errorConfig.colorClass}">
			{#if status === 400}
				<XCircle size={56} strokeWidth={1.5} />
			{:else if status === 401}
				<Lock size={56} strokeWidth={1.5} />
			{:else if status === 403}
				<Ban size={56} strokeWidth={1.5} />
			{:else if status === 404}
				<BookOpen size={56} strokeWidth={1.5} />
			{:else if status === 409}
				<AlertTriangle size={56} strokeWidth={1.5} />
			{:else if status === 429}
				<Clock size={56} strokeWidth={1.5} />
			{:else}
				<Server size={56} strokeWidth={1.5} />
			{/if}
		</div>

		<!-- Title -->
		<h1 class="error-title">{errorConfig.title}</h1>

		<!-- Message -->
		<p class="error-message">{message}</p>

		<!-- URL for 404 -->
		{#if status === 404}
			<div class="error-url">{$page.url.pathname}</div>
		{/if}

		<!-- Actions -->
		<div class="error-actions">
			<a href="/" class="btn btn-primary">
				<Home class="w-4 h-4" />
				<span>Go Home</span>
			</a>
			<button type="button" class="btn btn-secondary" onclick={goBack}>
				<ArrowLeft class="w-4 h-4" />
				<span>Go Back</span>
			</button>
			{#if status >= 500}
				<button type="button" class="btn btn-secondary" onclick={tryAgain}>
					<RefreshCw class="w-4 h-4" />
					<span>Try Again</span>
				</button>
			{/if}
		</div>

		<!-- Help for server errors -->
		{#if status >= 500}
			<div class="error-help">
				<h3>
					<AlertTriangle class="w-4 h-4" />
					<span>What you can try:</span>
				</h3>
				<ul>
					<li>Wait a moment and try again</li>
					<li>Check if the database file is accessible</li>
					<li>Restart the BookShelf application</li>
					<li>Check the application logs for more details</li>
				</ul>
			</div>
		{/if}

		<!-- Suggestions for 404 -->
		{#if status === 404}
			<div class="error-suggestions">
				<h3>Looking for something?</h3>
				<div class="suggestion-links">
					<a href="/books">
						<BookOpen class="w-4 h-4" />
						<span>Books</span>
					</a>
					<a href="/authors">
						<Users class="w-4 h-4" />
						<span>Authors</span>
					</a>
					<a href="/series">
						<Library class="w-4 h-4" />
						<span>Series</span>
					</a>
					<a href="/search">
						<Search class="w-4 h-4" />
						<span>Search</span>
					</a>
					<a href="/stats">
						<BarChart2 class="w-4 h-4" />
						<span>Statistics</span>
					</a>
				</div>
			</div>
		{/if}

		<!-- Debug info in development -->
		{#if import.meta.env.DEV && $page.error}
			<details class="error-details">
				<summary>
					<Bug class="w-4 h-4" />
					<span>Technical Details (Development)</span>
				</summary>
				<pre class="error-stack">{JSON.stringify($page.error, null, 2)}</pre>
			</details>
		{/if}
	</div>
</div>

<style>
	.error-page {
		min-height: calc(100vh - 4rem);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background-color: var(--bg-primary);
	}

	.error-container {
		text-align: center;
		max-width: 500px;
	}

	.error-code {
		font-size: 7rem;
		font-weight: 700;
		line-height: 1;
		margin-bottom: 0.5rem;
		opacity: 0.8;
	}

	.error-code.primary {
		color: var(--accent);
	}

	.error-code.warning {
		color: #f59e0b;
	}

	.error-code.error {
		color: #ef4444;
	}

	.error-icon {
		margin-bottom: 1.5rem;
		opacity: 0.7;
		display: flex;
		justify-content: center;
	}

	.error-icon.primary {
		color: var(--accent);
	}

	.error-icon.warning {
		color: #f59e0b;
	}

	.error-icon.error {
		color: #ef4444;
	}

	.error-title {
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}

	.error-message {
		color: var(--text-muted);
		margin-bottom: 1.5rem;
		font-size: 1rem;
		line-height: 1.6;
	}

	.error-url {
		background: var(--bg-tertiary);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-family: monospace;
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-bottom: 1.5rem;
		word-break: break-all;
		display: inline-block;
		max-width: 100%;
	}

	.error-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
		text-decoration: none;
	}

	.btn-primary {
		background-color: var(--accent);
		color: white;
	}

	.btn-primary:hover {
		background-color: var(--accent-hover);
	}

	.btn-secondary {
		background-color: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.btn-secondary:hover {
		background-color: var(--bg-hover);
	}

	.error-help {
		margin-top: 2rem;
		padding: 1rem 1.25rem;
		background: var(--bg-secondary);
		border-radius: 0.75rem;
		text-align: left;
		border: 1px solid var(--border-color);
	}

	.error-help h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: var(--text-primary);
	}

	.error-help ul {
		margin: 0;
		padding-left: 1.5rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.error-help li {
		margin-bottom: 0.35rem;
	}

	.error-suggestions {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-color);
	}

	.error-suggestions h3 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--text-primary);
	}

	.suggestion-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
	}

	.suggestion-links a {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		background: var(--bg-tertiary);
		border-radius: 0.5rem;
		text-decoration: none;
		color: var(--text-secondary);
		font-size: 0.85rem;
		transition: all 0.2s;
	}

	.suggestion-links a:hover {
		background: var(--accent);
		color: white;
	}

	.error-details {
		margin-top: 2rem;
		text-align: left;
	}

	.error-details summary {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
	}

	.error-details summary:hover {
		color: var(--text-primary);
	}

	.error-stack {
		background: var(--bg-tertiary);
		padding: 1rem;
		border-radius: 0.5rem;
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--text-secondary);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 300px;
		overflow-y: auto;
		margin-top: 0.5rem;
	}

	@media (max-width: 640px) {
		.error-code {
			font-size: 5rem;
		}

		.error-title {
			font-size: 1.5rem;
		}

		.error-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
