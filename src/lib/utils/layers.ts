/**
 * Esc stack. One capture-phase listener on window closes only the topmost open layer,
 * so a dropdown closes before the popup, and the popup before the form behind it.
 * Capture and stopPropagation also keep the other window listeners off that keypress.
 * With an empty stack the listener isn't installed, so pages with no layers are unaffected.
 */
type Layer = { close: () => void };

const stack: Layer[] = [];

function handleKeydown(e: KeyboardEvent) {
	// Ignoring repeats means a held key can't unwind every layer
	if (e.key !== 'Escape' || e.repeat || e.isComposing) return;
	const top = stack[stack.length - 1];
	if (!top) return;
	e.preventDefault();
	e.stopPropagation();
	top.close();
}

/** Registers a layer on top of the stack. Returns a cleanup that removes it from wherever it sits. */
export function pushLayer(close: () => void): () => void {
	if (stack.length === 0) window.addEventListener('keydown', handleKeydown, true);
	const layer: Layer = { close };
	stack.push(layer);

	return () => {
		const index = stack.indexOf(layer);
		if (index === -1) return;
		stack.splice(index, 1);
		if (stack.length === 0) window.removeEventListener('keydown', handleKeydown, true);
	};
}
