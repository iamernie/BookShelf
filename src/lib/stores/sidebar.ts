import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Get initial state from localStorage
const storedState = browser ? localStorage.getItem('sidebarCollapsed') === 'true' : false;

// Create the store
export const sidebarCollapsed = writable<boolean>(storedState);

// Subscribe to changes and persist to localStorage
if (browser) {
	sidebarCollapsed.subscribe((value) => {
		localStorage.setItem('sidebarCollapsed', String(value));
	});
}
