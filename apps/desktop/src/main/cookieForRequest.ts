/**
 * Whether a request leaving this client should carry the session, and what to carry.
 *
 * The window signs nobody in — that happens in a real browser, and what comes back lives in this
 * process where the page cannot read it. But the page still has to fetch libraries and artwork, and
 * a `<video>` element fetches segments with headers no script can set. So the session is attached
 * out here, to requests on their way out, which is the one place that can reach all of them.
 *
 * Only requests to the server somebody named. Anything else — an image from a metadata provider, an
 * update check — leaves with nothing, because a credential sent to a host that did not ask for it is
 * a credential given away.
 *
 * @param asked - Where the request is going.
 * @param server - The server this client was told to watch.
 * @param cookie - The session this process is holding.
 * @returns What to send as `Cookie`, or nothing where this request is not ours to sign.
 */
const cookieForRequest = (asked: string, server: string, cookie: string): string | null => {
  if (server === '' || cookie === '') {
    return null;
  }

  const going = URL.parse(asked);
  const watching = URL.parse(server);

  if (going === null || watching === null || going.origin !== watching.origin) {
    return null;
  }

  return cookie;
};

export { cookieForRequest };
