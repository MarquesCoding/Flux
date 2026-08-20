import { serverUrl } from '@FluxClient/query/serverUrl';

/**
 * Puts an address the server gave us onto the server it came from.
 *
 * The server answers with paths — where a manifest is, where a file is — because it has no idea
 * which of its addresses a client reached it on, and a browser needs none: a path resolves against
 * the page, and the page came from the server. A client serving its own pages resolves the same path
 * against itself and asks itself for a film.
 *
 * Only a path is moved. Anything already absolute is left exactly as it was, because that is a
 * decision the server made on purpose and not ours to overrule.
 *
 * @param given - What the server said.
 * @returns Where to actually go for it.
 */
const onThisServer = (given: string): string =>
  given.startsWith('/') ? serverUrl(given) : given;

export { onThisServer };
