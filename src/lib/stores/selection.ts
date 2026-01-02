import { writable, derived } from 'svelte/store';

/**
 * Store for managing multi-select state across the book grid
 */
function createSelectionStore() {
	const { subscribe, set, update } = writable<Set<number>>(new Set());

	return {
		subscribe,

		/**
		 * Toggle selection of a single item
		 */
		toggle: (id: number) => update(selected => {
			const newSet = new Set(selected);
			if (newSet.has(id)) {
				newSet.delete(id);
			} else {
				newSet.add(id);
			}
			return newSet;
		}),

		/**
		 * Select a single item (replacing current selection)
		 */
		select: (id: number) => set(new Set([id])),

		/**
		 * Add item to selection
		 */
		add: (id: number) => update(selected => {
			const newSet = new Set(selected);
			newSet.add(id);
			return newSet;
		}),

		/**
		 * Remove item from selection
		 */
		remove: (id: number) => update(selected => {
			const newSet = new Set(selected);
			newSet.delete(id);
			return newSet;
		}),

		/**
		 * Select all items from an array of IDs
		 */
		selectAll: (ids: number[]) => set(new Set(ids)),

		/**
		 * Clear all selections
		 */
		clear: () => set(new Set()),

		/**
		 * Check if an item is selected
		 */
		isSelected: (id: number) => {
			let result = false;
			subscribe(selected => {
				result = selected.has(id);
			})();
			return result;
		},

		/**
		 * Get array of selected IDs
		 */
		getIds: () => {
			let ids: number[] = [];
			subscribe(selected => {
				ids = Array.from(selected);
			})();
			return ids;
		}
	};
}

export const selectedBooks = createSelectionStore();

// Derived stores for convenience
export const hasSelection = derived(selectedBooks, $selected => $selected.size > 0);
export const selectionCount = derived(selectedBooks, $selected => $selected.size);
export const selectedIds = derived(selectedBooks, $selected => Array.from($selected));
