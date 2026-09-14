type PublicRoute = {
  method: 'GET' | 'POST';
  path: RegExp;
};

const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { method: 'GET', path: /^\/api\/health$/ },
  { method: 'GET', path: /^\/api\/setup\/status$/ },
  { method: 'POST', path: /^\/api\/setup$/ },
  { method: 'GET', path: /^\/api\/auth\// },
  { method: 'POST', path: /^\/api\/auth\// },
  { method: 'GET', path: /^\/api\/profiles\/avatars\/[^/]+$/ },
  { method: 'POST', path: /^\/api\/profiles\/[^/]+\/sign-in$/ },
  { method: 'GET', path: /^\/api\/share\/[^/]+$/ },
  { method: 'GET', path: /^\/api\/openapi\.json$/ },
  { method: 'GET', path: /^\/api\/reference$/ },
];

const FACE_ROUTES: readonly PublicRoute[] = [
  { method: 'GET', path: /^\/api\/profiles\/everyone$/ },
  { method: 'GET', path: /^\/api\/profiles\/[^/]+\/avatar$/ },
];

/**
 * Whether a request may be answered without a session — signing in, first-run setup, and the handful
 * of things a browser asks for before anybody has signed in. Matched on both method and path, so
 * that reading something openly does not also mean writing it.
 *
 * Who lives here is among them while the server says so. A wall of faces is how a household sharing
 * one television expects to be met — pick yourself and watch — so it is the way in a server opens
 * with. It is a setting rather than a rule, because the same wall tells anybody who asks every
 * profile's name, picture and identifier, which is a list of who to try passwords against and who to
 * address a party invitation to; a server facing the open internet can shut it.
 *
 * The generated avatars stay open: they are drawn from a style and a seed in the address and say
 * nothing about anybody. So does signing in as a face, which needs the identifier already and is a
 * password check rather than a way of finding one.
 *
 * @param method The HTTP method, as the request reports it.
 * @param path The request path, without its query.
 * @param showsFaces Whether this server shows who lives here before anybody has signed in.
 */
const isPublicRoute = (method: string, path: string, showsFaces = false): boolean =>
  [...PUBLIC_ROUTES, ...(showsFaces ? FACE_ROUTES : [])].some(
    (route) => route.method === method.toUpperCase() && route.path.test(path),
  );

export { isPublicRoute };
