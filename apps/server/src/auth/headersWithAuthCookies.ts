import { asCookiePairs } from '@FluxCore/functions/asCookiePairs';
import {
  AUTH_COOKIES_HEADER,
  isRelayedAuthCookie,
} from '@FluxCore/functions/relayedAuthCookies';

/**
 * Puts back the cookies a client with no shared origin is holding on its behalf, so that better-auth
 * reads them where it has always read them.
 *
 * That client cannot be sent a cookie and cannot set a `Cookie` header — a browser engine forbids
 * both, and a desktop window is a browser engine. So it is handed the values in a header of ours and
 * hands them back the same way, and this turns them back into the thing better-auth is looking for.
 * Nothing in the two-factor plugin learns that a second kind of client exists.
 *
 * Only the cookies named in `isRelayedAuthCookie` are accepted, so this cannot be used to present a
 * session. Both of them are signed with the server's own secret, so a value that was not issued here
 * fails to verify a moment later; what a request can do is present one it was already given, which
 * is what holding a cookie is.
 *
 * Appended rather than replacing, because a browser sends the real thing and is entitled to.
 *
 * @param headers - What the request carried.
 * @returns The headers to read the request with.
 */
const headersWithAuthCookies = (headers: Headers): Headers => {
  const held = headers.get(AUTH_COOKIES_HEADER);

  if (held === null) {
    return headers;
  }

  const kept = asCookiePairs(held.split(';'))
    .filter(({ name, value }) => isRelayedAuthCookie(name) && value !== '')
    .map(({ name, value }) => `${name}=${value}`);

  if (kept.length === 0) {
    return headers;
  }

  const carried = new Headers(headers);
  const already = carried.get('cookie');

  carried.set(
    'cookie',
    already === null || already === '' ? kept.join('; ') : `${already}; ${kept.join('; ')}`,
  );

  return carried;
};

export { headersWithAuthCookies };
