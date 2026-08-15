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
 * @param method The HTTP method, as the request reports it.
 * @param path The request path, without its query.
 */
const isPublicRoute = (method: string, path: string): boolean =>
  PUBLIC_ROUTES.some((route) => route.method === method.toUpperCase() && route.path.test(path));

export { isPublicRoute };
