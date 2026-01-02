import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
	if (!browser) return 'dark';
	return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
	if (!browser) return;

	const actualTheme = theme === 'system' ? getSystemTheme() : theme;
	document.documentElement.classList.remove('light', 'dark');
	document.documentElement.classList.add(actualTheme);
}

function createThemeStore() {
	// Get initial theme from localStorage or default to system
	const getInitialTheme = (): Theme => {
		if (!browser) return 'system';

		const stored = localStorage.getItem('theme') as Theme | null;
		if (stored === 'light' || stored === 'dark' || stored === 'system') {
			return stored;
		}

		return 'system';
	};

	const { subscribe, set: internalSet, update } = writable<Theme>(getInitialTheme());

	// Listen for system theme changes when in system mode
	if (browser) {
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			const current = get({ subscribe });
			if (current === 'system') {
				applyTheme('system');
			}
		});
	}

	return {
		subscribe,
		toggle: () => {
			update(current => {
				// Cycle through: system -> light -> dark -> system
				let next: Theme;
				if (current === 'system') {
					next = 'light';
				} else if (current === 'light') {
					next = 'dark';
				} else {
					next = 'system';
				}
				if (browser) {
					localStorage.setItem('theme', next);
					applyTheme(next);
				}
				return next;
			});
		},
		set: (theme: Theme) => {
			if (browser) {
				localStorage.setItem('theme', theme);
				applyTheme(theme);
			}
			internalSet(theme);
		}
	};
}

export const theme = createThemeStore();
