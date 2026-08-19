import { headersWithAuthCookies } from '@FluxServer/auth/headersWithAuthCookies';

/**
 * The same as `headersWithAuthCookies`, for the one caller that hands better-auth a whole request
 * rather than a set of headers.
 *
 * @param request - The request as it arrived.
 * @returns The request to hand on, which is the same one where there is nothing to put back.
 */
const requestWithAuthCookies = (request: Request): Request => {
  const carried = headersWithAuthCookies(request.headers);

  return carried === request.headers ? request : new Request(request, { headers: carried });
};

export { requestWithAuthCookies };
