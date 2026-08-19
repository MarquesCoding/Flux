const PLACEHOLDER_ORIGIN = 'http://flux.invalid';

/**
 * Puts what better-auth asked for onto the server a client is watching.
 *
 * The library is built against an address rather than being told one per request, and there is no
 * honest address to give it: a browser is answered by the page it was served, a desktop client by
 * whichever Flux somebody named, and neither is known when the client is built. So it is given an
 * address that resolves nowhere and every request has the path lifted off it and put on the real
 * one. A request that escapes this reaches nothing rather than quietly reaching somewhere wrong.
 *
 * Written here because two processes need it and they cannot share a client: the window asks through
 * the platform it was installed with, and the process that owns the window has no platform at all.
 *
 * @param server - Where the client is watching, or nothing for a browser answered by its own page.
 * @param asked - What the library asked for, absolute or not.
 * @returns Where to actually ask.
 */
const onTheServer = (server: string, asked: string): string => {
  const { pathname, search } = new URL(asked, PLACEHOLDER_ORIGIN);

  return `${server.replace(/\/+$/, '')}${pathname}${search}`;
};

export { onTheServer, PLACEHOLDER_ORIGIN };
