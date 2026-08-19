import { platformInUse } from '@FluxClient/platform/installPlatform';
import { hasNoSharedOrigin } from '@FluxClient/session/hasNoSharedOrigin';

const KEY = 'flux.session.token';

/**
 * Keeps the session token a client with no shared origin authenticates with.
 *
 * A browser never holds one: its cookie is first-party, `HttpOnly`, and better this way. A client
 * whose window serves its own pages cannot be sent that cookie at all, so it keeps the token the
 * server hands back and presents it instead — see ADR-0026.
 *
 * A browser is answered with nothing whatever it has in store, and this is not tidiness. better-auth
 * reads a bearer token by writing it over the session cookie on the request, so a browser that
 * presents a token it no longer has a session for loses the cookie that was working — every endpoint
 * answers 401 while the page still believes somebody is signed in.
 *
 * @returns The token this client is holding, or nothing where it holds none.
 */
const sessionToken = (): string | null =>
  hasNoSharedOrigin() ? platformInUse().store.read(KEY) : null;

/**
 * Keeps a token the server just handed out, so the next request can present it.
 *
 * A browser is handed one too — the server sets `set-auth-token` on anything that sets the session
 * cookie, and cannot tell who is asking. It is dropped rather than kept, and dropping it clears one
 * a browser was already holding from before this was so.
 *
 * @param token - The token from the response, or nothing to hold none.
 */
const rememberSessionToken = (token: string | null): void => {
  if (token === null || token === '' || !hasNoSharedOrigin()) {
    platformInUse().store.forget(KEY);

    return;
  }

  platformInUse().store.write(KEY, token);
};

/**
 * Says what a request should carry to be recognised, which is nothing at all in a browser.
 *
 * @returns The headers to add.
 */
const authorisation = (): Record<string, string> => {
  const token = sessionToken();

  return token === null || token === '' ? {} : { authorization: `Bearer ${token}` };
};

export { authorisation, rememberSessionToken, sessionToken };
