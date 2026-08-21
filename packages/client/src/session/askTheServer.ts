import { z } from 'zod';

const PLACEHOLDER = 'http://flux.invalid';

const WhereWeAreSchema = z.object({ protocol: z.string(), origin: z.string() });

const ACCEPTED = new Set(['http:', 'https:']);

/**
 * The base better-auth is given to build its addresses on.
 *
 * Where the page is is read rather than assumed, because this package is written without a document
 * in mind: it runs in a browser, in a window that serves its own pages, and in a test with neither.
 *
 * A browser has one already: the page's own origin, which is the server that served it, and which
 * the library is perfectly happy with. It is handed that.
 *
 * A client that serves its own pages has an origin of its own making — `flux://app` — which the
 * library refuses outright, so that one is handed a base it accepts and never asked to fetch. What
 * it builds on top is turned back into a path on the way out.
 *
 * The placeholder is only ever used where it is needed. Handing it to a browser as well would be
 * substituting a host that does not resolve for one that does, and every request the library made
 * without going through `askTheServer` would go looking for it.
 *
 * @returns The base to build on.
 */
const whereWeAre = (): { protocol: string; origin: string } | null => {
  const read = WhereWeAreSchema.safeParse(Reflect.get(globalThis, 'location'));

  return read.success ? read.data : null;
};

const theAuthBase = (): string => {
  const here = whereWeAre();

  return here !== null && ACCEPTED.has(here.protocol) ? here.origin : PLACEHOLDER;
};

const AUTH_BASE = theAuthBase();

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
 * A request that arrives already built is rebuilt where it carries the placeholder, rather than sent
 * as it stands. Anything that escaped with that host on it would go looking for a name that does not
 * resolve, fail, and be tried again.
 *
 * @param input - What the library asked for.
 * @param init - How it asked.
 * @returns The answer.
 */
const askTheServer = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  if (input instanceof Request) {
    if (!input.url.startsWith(PLACEHOLDER)) {
      return globalThis.fetch(input, init);
    }

    const ours = new URL(asOurOwn(input.url), whereWeAre()?.origin ?? PLACEHOLDER);

    return globalThis.fetch(new Request(ours, input), init);
  }

  return globalThis.fetch(asOurOwn(String(input)), init);
};

export { AUTH_BASE, PLACEHOLDER, askTheServer, theAuthBase };
