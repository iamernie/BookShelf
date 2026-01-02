import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration?: number;
}

// Generate a unique ID (fallback for when crypto.randomUUID is not available)
function generateId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback: simple unique ID
	return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function add(type: ToastType, message: string, duration = 5000) {
		// Only add toasts in the browser
		if (!browser) return '';

		const id = generateId();
		const toast: Toast = { id, type, message, duration };

		update((currentToasts) => [...currentToasts, toast]);

		if (duration > 0) {
			setTimeout(() => remove(id), duration);
		}

		return id;
	}

	function remove(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		success: (message: string, duration?: number) => add('success', message, duration),
		error: (message: string, duration?: number) => add('error', message, duration),
		warning: (message: string, duration?: number) => add('warning', message, duration),
		info: (message: string, duration?: number) => add('info', message, duration),
		remove
	};
}

export const toasts = createToastStore();
