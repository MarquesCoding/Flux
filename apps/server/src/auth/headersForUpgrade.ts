/**
 * Lets a socket say who is opening it, for a client that has no cookie to say it with.
 *
 * A browser sends its session cookie on the upgrade without being asked. A client with no shared
 * origin authenticates with a bearer token instead — ADR-0026 — and a browser WebSocket has no way
 * to set a header on the upgrade: there is no API for it. The address is the only thing it controls,
 * so the token arrives there and is turned back into the header the session lookup already reads.
 *
 * A request that carries no token is handed back unchanged, so a cookie keeps working exactly as it
 * did, and a request that already carries the header is left alone rather than overwritten.
 *
 * @param headers - The upgrade request's own headers.
 * @param token - What the address carried, where it carried anything.
 * @returns The headers to read the session from.
 */
const headersForUpgrade = (headers: Headers, token: string | undefined): Headers => {
  if (token === undefined || token === '' || headers.has('authorization')) {
    return headers;
  }

  const carried = new Headers(headers);

  carried.set('authorization', `Bearer ${token}`);

  return carried;
};

export { headersForUpgrade };
