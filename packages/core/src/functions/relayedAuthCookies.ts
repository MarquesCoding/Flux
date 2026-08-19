const AUTH_COOKIES_HEADER = 'x-flux-auth-cookies';

const SET_AUTH_COOKIES_HEADER = 'x-flux-set-auth-cookies';

const RELAYED = ['.two_factor', '.trust_device'] as const;

/**
 * Says whether a cookie is one a client with no shared origin has to be handed and hand back.
 *
 * ADR-0026 has such a client carry a bearer token instead of the session cookie, and better-auth's
 * `bearer` plugin makes that work — for the session cookie, which is the only one it knows about.
 * The two-factor plugin sets two of its own: the pending challenge, and the record of a device
 * somebody chose to trust. Neither reaches a client that cannot be sent a cookie, so a second factor
 * could be asked for and never answered.
 *
 * These two and no others. The session cookie is deliberately not among them — `bearer` already
 * carries it, and letting a request name it here would be a second way to present a session, on a
 * path built for something else.
 *
 * Matched by what the name ends with, because better-auth builds it from a prefix an operator can
 * change and a `__Secure-` one it adds itself on TLS, so `better-auth.two_factor` and
 * `__Secure-better-auth.two_factor` are the same cookie under two names.
 *
 * @param name - The cookie's name.
 * @returns Whether it is relayed.
 */
const isRelayedAuthCookie = (name: string): boolean =>
  RELAYED.some((ending) => name.endsWith(ending));

export { AUTH_COOKIES_HEADER, isRelayedAuthCookie, SET_AUTH_COOKIES_HEADER };
