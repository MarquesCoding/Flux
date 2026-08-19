import { asCookiePairs } from '@FluxCore/functions/asCookiePairs';
import {
  isRelayedAuthCookie,
  SET_AUTH_COOKIES_HEADER,
} from '@FluxCore/functions/relayedAuthCookies';

/**
 * Hands a client the cookies it cannot be sent, in a header it is allowed to read.
 *
 * The mirror of `headersWithAuthCookies`, and modelled on what better-auth's own `bearer` plugin
 * does with the session cookie: it answers with `set-auth-token` because a client that cannot hold a
 * cookie can still read a header. This does the same for the two the two-factor plugin sets, which
 * `bearer` does not know about.
 *
 * A cookie being cleared is passed on as it stands, emptied. That is the server saying the challenge
 * is over, and a client that is not told keeps presenting something already spent.
 *
 * The response is rebuilt rather than edited because the one better-auth returns has locked headers.
 * Where there is nothing to hand over, the original is returned untouched.
 *
 * @param response - What the server is about to answer with.
 * @returns The answer to send.
 */
const exposeAuthCookies = (response: Response): Response => {
  const relayed = asCookiePairs(
    response.headers.getSetCookie().map((one) => one.split(';')[0] ?? ''),
  ).filter(({ name }) => isRelayedAuthCookie(name));

  if (relayed.length === 0) {
    return response;
  }

  const answered = new Response(response.body, response);

  answered.headers.set(
    SET_AUTH_COOKIES_HEADER,
    relayed.map(({ name, value }) => `${name}=${value}`).join('; '),
  );

  return answered;
};

export { exposeAuthCookies };
