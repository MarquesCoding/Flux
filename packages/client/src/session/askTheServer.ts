/**
 * Sends what better-auth asked for, through the global `fetch` at the moment it is asked.
 *
 * Handed to the library rather than left to be found, for two reasons and no others: it reads the
 * global once when the client is built, which is before a test has had a chance to stand in for it,
 * and it asks with a `URL` where a caller may be expecting a string.
 *
 * Nothing else is done to the request. Every client Flux has is served by the Flux it talks to — a
 * browser by definition, a desktop window because it loads the server's own pages — so a request to
 * `/api/auth` is a request to the page's own origin, and a cookie is a cookie.
 *
 * @param input - What the library asked for.
 * @param init - How it asked.
 * @returns The answer.
 */
const askTheServer = (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
  input instanceof Request
    ? globalThis.fetch(input, init)
    : globalThis.fetch(String(input), init);

export { askTheServer };
