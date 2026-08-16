/**
 * Writes a date the way the API contract carries them, keeping the absence of a date as an absence
 * rather than turning it into a string.
 *
 * @param value - The date, or null where there is none.
 * @returns It in ISO form, or null.
 */
const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

export { toIso };
