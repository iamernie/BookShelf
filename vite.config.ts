import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

// Read version from package.json at build time
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		// Inject version as a global constant at build time
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	server: {
		port: 5173,
		host: true
	}
});
