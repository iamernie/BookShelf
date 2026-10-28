/**
 * Grouping key for the Data Cleanup duplicate finders (authors, series)
 *
 * Names that differ only by case, punctuation or spacing must produce the same
 * key: 'J.N. Chaney', 'J. N. Chaney' and 'JN Chaney' all become 'jnchaney'.
 * The key is for grouping only - never show it to the user.
 *
 * `refine` runs on the lowercased, punctuation-stripped, single-spaced form
 * (before all whitespace is removed), so callers can drop word-level noise
 * such as a leading "the".
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
