/**
 * A request shape that needs no session, and the reason it does not.
 */
type PublicRoute = {
  method: 'GET' | 'POST';
  path: RegExp;
};

/**
 * Everything reachable without signing in.
 *
 * Deliberately short, and deliberately an allowlist rather than a list of
 * things to protect: a route that nobody thought about is then closed rather
 * than open, which is the failure this list exists to prevent.
 *
 * Each entry earns its place:
 *
 * - Health is what a container orchestrator polls, and it has no credentials.
 * - Setup runs before any account exists. Its handler answers `409` once one
 *   does, so it stops being a way in the moment it stops being needed.
 * - better-auth owns `/api/auth/*` wholesale, including which of its own
 *   routes require a session. Gating it here would break signing in.
 * - The profile routes are the sign-in screen itself: a wall of faces rather
 *   than a box asking for an address. Names and pictures only — an address is
 *   resolved server-side and never sent to a page nobody has signed into.
 * - The specification and the reference describe the shape of the API and
 *   carry none of its data.
 */
const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { method: 'GET', path: /^\/api\/health$/ },
  { method: 'GET', path: /^\/api\/setup\/status$/ },
  { method: 'POST', path: /^\/api\/setup$/ },
  { method: 'GET', path: /^\/api\/auth\// },
  { method: 'POST', path: /^\/api\/auth\// },
  { method: 'GET', path: /^\/api\/profiles\/everyone$/ },
  { method: 'GET', path: /^\/api\/profiles\/avatars\/[^/]+$/ },
  { method: 'GET', path: /^\/api\/profiles\/[^/]+\/avatar$/ },
  { method: 'POST', path: /^\/api\/profiles\/[^/]+\/sign-in$/ },
  { method: 'GET', path: /^\/api\/openapi\.json$/ },
  { method: 'GET', path: /^\/api\/reference$/ },
];

/**
 * Whether a request may be answered without a session.
 *
 * Matched on the method as well as the path, so that a path being readable
 * never implies it is writable — `/api/profiles/{id}/avatar` is a picture on
 * the sign-in screen, and nothing about that makes it postable.
 *
 * @param method The HTTP method, as the request reports it.
 * @param path The request path, without its query.
 */
const isPublicRoute = (method: string, path: string): boolean =>
  PUBLIC_ROUTES.some((route) => route.method === method.toUpperCase() && route.path.test(path));

export { isPublicRoute };
