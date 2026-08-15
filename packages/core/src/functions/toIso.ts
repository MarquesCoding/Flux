/**
 * A stored timestamp as the API writes them.
 *
 * Every timestamp crossing the API is an ISO string, while every timestamp
 * coming back out of Postgres is a `Date`, and the columns that are allowed
 * to be absent come back null. Doing the conversion in one place means a
 * nullable column cannot quietly become the string `"null"` in one service
 * and stay null in another.
 *
 * @param value The timestamp as the database returned it.
 */
const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

export { toIso };
