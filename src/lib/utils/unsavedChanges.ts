/**
 * Unsaved-changes guards. Every exit from a dirty form asks; Save never does.
 * Dirty means "what Save would persist differs from what the form held after mount",
 * so comparing normalized snapshots avoids false prompts from raw input state.
 */
import { beforeNavigate } from '$app/navigation';

export function confirmDiscard(): boolean {
	return confirm('Discard changes? Your edits have not been saved.');
}

/**
 * Call during component init. Kit turns tab close and reload into type 'leave', where
 * cancel() raises the browser's own prompt; confirm() is blocked during unload, so never call it there.
 */
export function guardNavigation(isDirty: () => boolean): void {
	beforeNavigate((nav) => {
		if (!isDirty()) return;
		if (nav.type === 'leave') {
			nav.cancel();
			return;
		}
		if (!confirmDiscard()) nav.cancel();
	});
}

/** A close handler for X, backdrop, Esc and Cancel. Pass `() => onClose()` so the latest prop is read. */
export function guardedClose(isDirty: () => boolean, close: () => void, isBusy?: () => boolean): () => void {
	return () => {
		if (isBusy?.()) return;
		if (isDirty() && !confirmDiscard()) return;
		close();
	};
}

export interface DirtyTracker<T> {
	/** Takes the baseline. Call in onMount, once the form holds its initial values. */
	capture(): void;
	/** Moves only these parts of the baseline, leaving the rest dirty if they differ. */
	adopt(part: Partial<T>): void;
	/** A submit is on its way to its own navigation; pass false if it failed. */
	markSubmitted(submitted?: boolean): void;
	isDirty(): boolean;
}

/** Sorted copy, for id lists whose order doesn't change what Save persists. */
export function sortedIds(ids: readonly number[]): number[] {
	return [...ids].sort((a, b) => a - b);
}

/**
 * Compares a snapshot against a baseline stored as one JSON string per key, so it never
 * holds a reference to $state. Before capture there is nothing to lose, so it reads clean.
 */
export function trackDirty<T extends object>(snapshot: () => T): DirtyTracker<T> {
	let baseline: Record<string, string | undefined> | null = null;
	let submitted = false;

	function serialize(value: object): Record<string, string | undefined> {
		const parts: Record<string, string | undefined> = {};
		for (const [key, part] of Object.entries(value)) parts[key] = JSON.stringify(part);
		return parts;
	}

	return {
		capture() {
			baseline = serialize(snapshot());
		},
		adopt(part) {
			if (baseline) Object.assign(baseline, serialize(part));
		},
		markSubmitted(value = true) {
			submitted = value;
		},
		isDirty() {
			if (submitted || !baseline) return false;
			try {
				const current = serialize(snapshot());
				const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
				for (const key of keys) {
					if (baseline[key] !== current[key]) return true;
				}
				return false;
			} catch {
				// A throw in a beforeNavigate callback would kill the navigation with no prompt
				return true;
			}
		}
	};
}
