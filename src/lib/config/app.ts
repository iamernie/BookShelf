// Application configuration
// Version and copyright info used across the app

// Version is injected by Vite at build time from package.json
// See vite.config.ts for the define configuration
declare const __APP_VERSION__: string;

export const APP_CONFIG = {
	name: 'BookShelf',
	version: __APP_VERSION__,
	copyright: {
		owner: 'Ernie',
		year: 2026
	},
	// Formatted strings for display
	get versionString() {
		return `v${this.version}`;
	},
	get copyrightString() {
		return `${this.copyright.year} ${this.copyright.owner}`;
	}
};
