<script lang="ts">
	import { browser } from '$app/environment';
	import { APP_CONFIG } from '$lib/config/app';
	import { X, ArrowUpCircle } from 'lucide-svelte';

	interface UpdateInfo {
		latestVersion: string;
		currentVersion: string;
		releaseUrl: string;
	}

	let updateInfo = $state<UpdateInfo | null>(null);
	let dismissed = $state(false);
	let checking = $state(false);

	const STORAGE_KEY = 'bookshelf-dismissed-version';
	const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
	const LAST_CHECK_KEY = 'bookshelf-last-update-check';

	// Compare semantic versions: returns true if v1 < v2
	function isNewerVersion(current: string, latest: string): boolean {
		const parseVersion = (v: string) => {
			const clean = v.replace(/^v/, '');
			const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
			return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
		};

		const curr = parseVersion(current);
		const lat = parseVersion(latest);

		if (lat.major > curr.major) return true;
		if (lat.major < curr.major) return false;
		if (lat.minor > curr.minor) return true;
		if (lat.minor < curr.minor) return false;
		return lat.patch > curr.patch;
	}

	async function checkForUpdates() {
		if (!browser || checking) return;

		// Check if we should skip (already checked recently)
		const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
		if (lastCheck) {
			const lastCheckTime = parseInt(lastCheck, 10);
			if (Date.now() - lastCheckTime < CHECK_INTERVAL) {
				// Use cached result if available
				const cached = localStorage.getItem('bookshelf-latest-version');
				if (cached) {
					const { version, url } = JSON.parse(cached);
					processVersionCheck(version, url);
				}
				return;
			}
		}

		checking = true;

		try {
			const response = await fetch(
				'https://api.github.com/repos/iamernie/BookShelf/releases/latest',
				{
					headers: {
						'Accept': 'application/vnd.github.v3+json'
					}
				}
			);

			if (!response.ok) {
				console.warn('Failed to check for updates:', response.status);
				return;
			}

			const data = await response.json();
			const latestVersion = data.tag_name?.replace(/^v/, '') || '';
			const releaseUrl = data.html_url || `${APP_CONFIG.links.github}/releases`;

			// Cache the result
			localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
			localStorage.setItem('bookshelf-latest-version', JSON.stringify({
				version: latestVersion,
				url: releaseUrl
			}));

			processVersionCheck(latestVersion, releaseUrl);
		} catch (error) {
			console.warn('Error checking for updates:', error);
		} finally {
			checking = false;
		}
	}

	function processVersionCheck(latestVersion: string, releaseUrl: string) {
		const currentVersion = APP_CONFIG.version;

		// Check if user dismissed this specific version
		const dismissedVersion = localStorage.getItem(STORAGE_KEY);
		if (dismissedVersion === latestVersion) {
			dismissed = true;
			return;
		}

		// Check if there's a newer version
		if (isNewerVersion(currentVersion, latestVersion)) {
			updateInfo = {
				latestVersion,
				currentVersion,
				releaseUrl
			};
			dismissed = false;
		}
	}

	function handleDismiss() {
		if (updateInfo) {
			localStorage.setItem(STORAGE_KEY, updateInfo.latestVersion);
		}
		dismissed = true;
	}

	// Check for updates on mount
	$effect(() => {
		if (browser) {
			// Small delay to not block initial render
			setTimeout(checkForUpdates, 2000);
		}
	});
</script>

{#if updateInfo && !dismissed}
	<div class="update-banner">
		<div class="update-content">
			<ArrowUpCircle class="update-icon" />
			<span class="update-text">
				<strong>Update available!</strong>
				You're on v{updateInfo.currentVersion}, latest is v{updateInfo.latestVersion}
			</span>
			<a
				href={updateInfo.releaseUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="update-link"
			>
				View Release
			</a>
		</div>
		<button
			class="dismiss-btn"
			onclick={handleDismiss}
			aria-label="Dismiss update notification"
		>
			<X class="w-4 h-4" />
		</button>
	</div>
{/if}

<style>
	.update-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		background: linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, #000) 100%);
		color: white;
		font-size: 0.875rem;
		z-index: 100;
	}

	.update-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.update-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.update-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.update-text strong {
		font-weight: 600;
	}

	.update-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.75rem;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 9999px;
		font-weight: 500;
		transition: background-color 0.2s;
		text-decoration: none;
		color: white;
	}

	.update-link:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.dismiss-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		transition: all 0.2s;
	}

	.dismiss-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		color: white;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.update-banner {
			padding: 0.5rem 0.75rem;
		}

		.update-text {
			font-size: 0.8rem;
		}

		.update-link {
			padding: 0.2rem 0.5rem;
			font-size: 0.75rem;
		}
	}
</style>
