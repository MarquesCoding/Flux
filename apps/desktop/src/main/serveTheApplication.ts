import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { app, net, protocol } from 'electron';
import { theServerAddress } from '@ValenceDesktop/main/theServerAddress';

const SCHEME = 'flux';

const HOST = 'app';

const ORIGIN = `${SCHEME}://${HOST}`;

const CARRIED = ['accept', 'content-type', 'range', 'x-flux-profile', 'authorization'];

const POLICY = [
  "default-src 'self'",
  `script-src 'self' ${SCHEME}://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const TYPES = new Map([
  ['html', 'text/html'],
  ['js', 'text/javascript'],
  ['mjs', 'text/javascript'],
  ['css', 'text/css'],
  ['json', 'application/json'],
  ['svg', 'image/svg+xml'],
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['woff', 'font/woff'],
  ['woff2', 'font/woff2'],
]);

/**
 * Claims the scheme this client's pages are served from, before anything can ask about it.
 *
 * Has to happen before the application is ready, which is why it is separate from everything else
 * here. The scheme is declared standard and secure so that a page on it behaves like a page on
 * https: it may hold a service worker, it may use the fetch API, and nothing in it is treated as a
 * local file with a local file's restrictions.
 */
const claimTheScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
};

/**
 * Picks the headers worth passing on.
 *
 * A request made by a page carries a great deal the page did not write — where it came from, what it
 * expects, what kind of thing it is fetching — and several of those may not be set by hand on the
 * way out. Forwarding the lot gets the request refused before it leaves, which arrives back as a
 * failure with no cause attached.
 *
 * What matters is what the page meant: what it will accept, what it is sending, which part of a file
 * it wants, and which face is watching.
 *
 * @param from - The headers the page sent.
 * @returns The ones to send onward.
 */
const worthCarrying = (from: Headers): Record<string, string> => {
  const kept: Record<string, string> = {};

  for (const name of CARRIED) {
    const value = from.get(name);

    if (value !== null) {
      kept[name] = value;
    }
  }

  return kept;
};

/**
 * Answers as the server would when it cannot be asked.
 *
 * A refusal has to arrive as an answer rather than as nothing. A handler that throws gives the page
 * an error with no status and no body, which every screen reads as something unimaginable rather
 * than as a server that is off — and a page that asked for JSON and was handed this client's own
 * index.html reads it as a server speaking nonsense.
 *
 * A server that could not be reached is answered as unavailable rather than as a bad gateway,
 * because the two are retried differently and the first is usually a moment rather than a fault: a
 * client and a server started together race, and the client asks first. Saying so lets the screen
 * that asked try again instead of reporting that Valence is broken.
 *
 * @param status - What to say went wrong.
 * @param error - Why, in the shape the rest of the API says it.
 * @returns The answer.
 */

const said = (status: number, error: string): Response =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Answers with a page, and says what that page is allowed to load.
 *
 * A renderer with no policy may load and run anything it is told to, which is worth saying out loud
 * for an application whose whole purpose is displaying a server's own descriptions of things. The
 * policy is written here rather than into the document, so a page built for a browser is not carrying
 * a desktop client's rules around with it.
 *
 * Inline styles are allowed because animation sets them: every element that moves is moved by writing
 * a style attribute to it, and a policy that refused those would leave a still application. The cast
 * sender is named because a page written for a browser asks for it without a scheme, so it arrives
 * on this client's own scheme and is fetched from Google as itself.
 *
 * Only the packaged bundle is served this way. In development the pages come from Vite, which serves
 * its own inline module scripts, and a policy strict enough to be worth having would refuse them.
 *
 * @param page - The document.
 * @returns The answer, with the policy attached.
 */
const aPage = (page: Buffer): Response =>
  new Response(new Uint8Array(page), {
    headers: { 'content-type': 'text/html', 'content-security-policy': POLICY },
  });

/**
 * Serves this client's own pages, and passes everything it asks of Valence through to the server.
 *
 * This is what makes the application a host rather than a window onto somebody else's pages, and it
 * is the answer to the thing that made the previous attempt painful. Every request the page makes —
 * an API call, a poster, a subtitle, a segment of video — leaves on the same origin, so nothing is
 * cross-origin, no preflight happens, and no cookie is dropped for being third-party. The requests
 * that go on to Valence are made out here in the main process, where none of those rules exist at all
 * and where one session holds the cookie for every one of them.
 *
 * A path that belongs to Valence is proxied. Everything else is this client's own bundle, and a path
 * that names nothing gets the document, because the router in the page owns the address.
 *
 * An address on any other host is fetched as itself over https. A page written for a browser names
 * things without a scheme — `//www.gstatic.com/…` is how the cast sender is asked for — and under a
 * scheme of our own that resolves to a host of our own, which this client would otherwise answer
 * with its own document. A page that asked for a script and was handed HTML fails at the first `<`.
 *
 * A body is read before it is sent on. It arrives as a stream, and passing a stream onward needs the
 * request declared as one; the bodies here are a device profile and a place in a film, so reading
 * them first costs nothing and works.
 */
const serveTheApplication = (): void => {
  const roots = join(app.getAppPath(), 'dist');

  protocol.handle(SCHEME, async (request) => {
    const asked = new URL(request.url);
    const server = theServerAddress();

    if (asked.host !== HOST) {
      const onward = `https://${asked.host}${asked.pathname}${asked.search}`;

      try {
        return await net.fetch(onward, {
          method: request.method,
          headers: worthCarrying(request.headers),
        });
      } catch {
        return said(502, `${asked.host} could not be reached.`);
      }
    }

    if (asked.pathname.startsWith('/api/')) {
      if (server === '') {
        return said(503, 'No Valence has been chosen yet.');
      }

      const onward = new URL(asked.pathname + asked.search, server);

      const sent = request.body === null ? null : await request.arrayBuffer();

      try {
        return await net.fetch(onward.toString(), {
          method: request.method,
          headers: worthCarrying(request.headers),
          ...(sent === null || sent.byteLength === 0 ? {} : { body: sent }),
          credentials: 'include',
        });
      } catch {
        return said(503, `Valence could not be reached at ${server}.`);
      }
    }

    const served = process.env['ELECTRON_RENDERER_URL'];

    if (served !== undefined && served !== '') {
      const onward = new URL(asked.pathname + asked.search, served).toString();

      try {
        return await net.fetch(onward, {
          method: request.method,
          headers: worthCarrying(request.headers),
        });
      } catch {
        return said(502, `This client's own pages could not be read from ${served}.`);
      }
    }

    const name = asked.pathname === '/' ? 'index.html' : asked.pathname.slice(1);
    const held = await readFile(join(roots, name)).catch(() => null);

    if (held === null) {
      const page = await readFile(join(roots, 'index.html'));

      return aPage(page);
    }

    const kind = TYPES.get(name.slice(name.lastIndexOf('.') + 1)) ?? 'application/octet-stream';

    return kind === 'text/html'
      ? aPage(held)
      : new Response(held, { headers: { 'content-type': kind } });
  });
};

export { ORIGIN, claimTheScheme, serveTheApplication };
