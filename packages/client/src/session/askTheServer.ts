const PLACEHOLDER = 'http://flux.invalid';

const AUTH_BASE = PLACEHOLDER;

/**
 * Turns whatever better-auth built into an address this client can actually ask for.
 *
 * The library insists on a base beginning `http` and reads the page's own origin where it is not
 * told one. A client that serves its own pages has an origin of its own making — `flux://app` —
 * which the library refuses outright. So it is handed a base it accepts and never asked to fetch it:
 * what it builds on top is turned back into a path here, on the way out, and the request goes to the
 * page's own origin like every other.
 *
 * @param input - What the library asked for.
 * @returns The same request, aimed at the page's own origin.
 */
const asOurOwn = (input: string): string =>
  input.startsWith(PLACEHOLDER) ? input.slice(PLACEHOLDER.length) : input;

/**
 * Sends what better-auth asked for, through the global `fetch` at the moment it is asked.
 *
 * Handed to the library rather than left to be found, for two reasons and no others: it reads the
 * global once when the client is built, which is before a test has had a chance to stand in for it,
 * and it asks with a `URL` where a caller may be expecting a string.
 *
 * Every request leaves on the page's own origin. In a browser that is the server, because the server
 * served the page. In a client that serves its own pages it is that client, which passes what it
 * hears on to the server in the process that owns the window — so a cookie is still a cookie, and
 * nothing here is cross-origin either way.
 *
 * @param input - What the library asked for.
 * @param init - How it asked.
 * @returns The answer.
 */
const askTheServer = (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
  input instanceof Request
    ? globalThis.fetch(input, init)
    : globalThis.fetch(asOurOwn(String(input)), init);

export { AUTH_BASE, askTheServer };
