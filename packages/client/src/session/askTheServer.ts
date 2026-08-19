import { onTheServer as pathOnTheServer, PLACEHOLDER_ORIGIN } from '@FluxCore/functions/onTheServer';
import { platformInUse } from '@FluxClient/platform/installPlatform';

const onTheServer = (asked: string): string =>
  pathOnTheServer(platformInUse().whereTheServerIs(), asked);

/**
 * Sends what better-auth asked for to the server this client watches.
 *
 * The client is built against an origin that does not exist, and every request is moved onto the one
 * this client actually watches. That is what lets somebody change which server they are watching
 * without the client being rebuilt, which a desktop client does on the screen it opens with.
 *
 * Nothing is added to the request. A browser is recognised by its cookie, and a client with a window
 * of its own is recognised by the same cookie, attached out where the window cannot reach — see
 * ADR-0026. A shim here once carried a token and the cookies a token could not, which was a great
 * deal of machinery to work around an engine that this client no longer runs on.
 *
 * Its `fetch` is handed over rather than left to be found, for two reasons and no others: the
 * library reads the global once when the client is built, which is before a test has had a chance to
 * stand in for it, and it asks with a `URL` where a caller may be expecting a string.
 *
 * @param input - What the library asked for.
 * @param init - How it asked.
 * @returns The answer.
 */
const askTheServer = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const asked = input instanceof Request ? input.url : String(input);

  return input instanceof Request
    ? globalThis.fetch(new Request(onTheServer(asked), input))
    : globalThis.fetch(onTheServer(asked), init);
};

export { askTheServer, PLACEHOLDER_ORIGIN };
