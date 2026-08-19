import {
  AUTH_COOKIES_HEADER,
  SET_AUTH_COOKIES_HEADER,
} from '@FluxCore/functions/relayedAuthCookies';
import { onTheServer as pathOnTheServer, PLACEHOLDER_ORIGIN } from '@FluxCore/functions/onTheServer';
import { platformInUse } from '@FluxClient/platform/installPlatform';
import { authCookies, rememberAuthCookies } from '@FluxClient/session/authCookies';
import { authorisation, rememberSessionToken } from '@FluxClient/session/sessionToken';

const onTheServer = (asked: string): string =>
  pathOnTheServer(platformInUse().whereTheServerIs(), asked);

/**
 * Sends what better-auth asked for to the server this client watches, carrying whatever says who it
 * is and keeping any token that comes back.
 *
 * A browser is recognised by its cookie and this adds nothing. A client whose window serves its own
 * pages cannot be sent that cookie, so it presents the token instead and holds the one every
 * signing-in response hands back — see ADR-0026.
 *
 * The client is built against an origin that does not exist, and every request is moved onto the one
 * this client actually watches. That is what lets somebody change which server they are watching
 * without the client being rebuilt, which a desktop client does on the screen it opens with.
 *
 * The two-factor plugin also sets cookies of its own, which `bearer` knows nothing about. They are
 * carried in a header of ours in both directions, since a browser engine will neither store a
 * cross-site cookie nor let a script set a `Cookie` header, and the server puts them back.
 *
 * A header the caller already set is left alone, since it knows something this does not.
 *
 * @param input - What the library asked for.
 * @param init - How it asked.
 * @returns The answer.
 */
const askTheServer = async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const asked = input instanceof Request ? input.url : String(input);
  const carried = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));

  for (const [name, value] of Object.entries(authorisation())) {
    if (!carried.has(name)) {
      carried.set(name, value);
    }
  }

  const holding = authCookies();

  if (holding !== null && !carried.has(AUTH_COOKIES_HEADER)) {
    carried.set(AUTH_COOKIES_HEADER, holding);
  }

  const response =
    input instanceof Request
      ? await globalThis.fetch(new Request(onTheServer(asked), input), { headers: carried })
      : await globalThis.fetch(onTheServer(asked), { ...init, headers: carried });

  const handed = response.headers.get('set-auth-token');

  if (handed !== null) {
    rememberSessionToken(handed);
  }

  const handedCookies = response.headers.get(SET_AUTH_COOKIES_HEADER);

  if (handedCookies !== null) {
    rememberAuthCookies(handedCookies);
  }

  return response;
};

export { askTheServer, PLACEHOLDER_ORIGIN };
