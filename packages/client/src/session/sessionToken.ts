import { platformInUse } from '@FluxClient/platform/installPlatform';

const KEY = 'flux.session.token';

/**
 * Keeps the session token a client with no shared origin authenticates with.
 *
 * A browser never holds one: its cookie is first-party, `HttpOnly`, and better this way. A client
 * whose window serves its own pages cannot be sent that cookie at all, so it keeps the token the
 * server hands back and presents it instead — see ADR-0026.
 *
 * @returns The token this client is holding, or nothing where it holds none.
 */
const sessionToken = (): string | null => platformInUse().store.read(KEY);

/**
 * Keeps a token the server just handed out, so the next request can present it.
 *
 * @param token - The token from the response, or nothing to hold none.
 */
const rememberSessionToken = (token: string | null): void => {
  if (token === null || token === '') {
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
