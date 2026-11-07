/**
 * Grouping key for the Data Cleanup duplicate finders (authors, series, narrators)
 *
 * Names that differ only by case, punctuation or spacing must produce the same
 * key: 'J.N. Chaney', 'J. N. Chaney' and 'JN Chaney' all become 'jnchaney'.
 * The key is for grouping only - never show it to the user.
 *
 * `refine` runs on the lowercased, punctuation-stripped, single-spaced form
 * (before all whitespace is removed), so callers can drop word-level noise
 * such as a leading "the".
 *
 * Pure, so client code (pickers, metadata apply) shares it; server code imports it via $lib/server/utils/nameNormalization.
 */
export function duplicateNameKey(name: string, refine?: (spaced: string) => string): string {
	let spaced = name
		.toLowerCase()
		.replace(/[.,:-]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (refine) spaced = refine(spaced);

	return spaced.replace(/\s/g, '');
}

/** The entry whose name shares the duplicate name key with `name`; lowest id wins among several (same as the server). */
export function findByNameKey<T extends { id: number; name: string }>(list: T[], name: string): T | undefined {
	const key = duplicateNameKey(name);
	let best: T | undefined;
	for (const entry of list) {
		if (duplicateNameKey(entry.name ?? '') === key && (!best || entry.id < best.id)) best = entry;
	}
	return best;
}

/** Picker filter: plain case-insensitive substring, or the typed text's name key inside the entry's key ('RC Bray' finds 'R. C. Bray') */
export function nameMatchesSearch(name: string, search: string): boolean {
	if (name.toLowerCase().includes(search.toLowerCase())) return true;
	const key = duplicateNameKey(search);
	return key.length > 0 && duplicateNameKey(name).includes(key);
}
