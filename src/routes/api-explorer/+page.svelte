<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let swaggerContainer: HTMLDivElement;

	onMount(async () => {
		if (!browser) return;

		// Dynamically import swagger-ui bundle and standalone preset
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const SwaggerUIBundle = (await import('swagger-ui-dist/swagger-ui-bundle.js' as any)).default;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const SwaggerUIStandalonePreset = (await import('swagger-ui-dist/swagger-ui-standalone-preset.js' as any)).default;

		// Import the CSS
		await import('swagger-ui-dist/swagger-ui.css');

		SwaggerUIBundle({
			dom_id: '#swagger-ui',
			url: '/api/docs',
			deepLinking: true,
			presets: [
				SwaggerUIBundle.presets.apis,
				SwaggerUIStandalonePreset
			],
			plugins: [
				SwaggerUIBundle.plugins.DownloadUrl
			],
			layout: 'StandaloneLayout'
		});
	});
</script>

<svelte:head>
	<title>API Documentation - BookShelf</title>
</svelte:head>

<div class="swagger-wrapper">
	<div id="swagger-ui" bind:this={swaggerContainer}></div>
</div>

<style>
	.swagger-wrapper {
		min-height: 100vh;
		background: #fafafa;
	}

	:global(.swagger-ui .topbar) {
		display: none;
	}

	:global(.swagger-ui .info) {
		margin: 20px 0;
	}

	:global(.swagger-ui .scheme-container) {
		background: #fff;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.15);
	}
</style>
