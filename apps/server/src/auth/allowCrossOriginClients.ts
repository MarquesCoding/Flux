import { createMiddleware } from 'hono/factory';
import { originIsAllowed } from '@FluxServer/auth/originIsAllowed';

const ALLOWED_HEADERS = ['authorization', 'content-type', 'accept', 'range'];

const EXPOSED_HEADERS = ['content-range', 'content-length', 'accept-ranges'];

const PREFLIGHT_SECONDS = 600;

type AllowCrossOriginClientsOptions = {
  trustedOrigins: () => Promise<readonly string[]>;
};

/**
 * Lets a client with a window of its own read what the server answers.
 *
 * A browser Flux served is same-origin and never involves any of this. A desktop client serves its
 * own pages, so every request it makes is cross-origin and a browser engine will hide the answer
 * unless the server says who may read it — which is why the client came up saying Flux was not
 * reachable while the server was answering every request perfectly well.
 *
 * The credential header matters as much as the origin. better-auth asks with credentials, and an
 * engine discards a reply to such a request unless the server allows them explicitly, however
 * correct the origin is.
 *
 * The origins are the ones better-auth is already given, read per request rather than at startup so
 * that an operator adding one on the admin page is obeyed without a restart.
 *
 * @param trustedOrigins - The origins this deployment answers to.
 * @returns The middleware.
 */
const allowCrossOriginClients = ({ trustedOrigins }: AllowCrossOriginClientsOptions) =>
  createMiddleware(async (context, next) => {
    const asked = context.req.header('origin');
    const allowed = originIsAllowed(asked, await trustedOrigins());

    if (allowed === null) {
      if (context.req.method === 'OPTIONS') {
        return context.body(null, 204);
      }

      await next();

      return;
    }

    if (context.req.method === 'OPTIONS') {
      return context.body(null, 204, {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
        'Access-Control-Max-Age': PREFLIGHT_SECONDS.toString(),
        Vary: 'Origin',
      });
    }

    await next();

    context.res.headers.set('Access-Control-Allow-Origin', allowed);
    context.res.headers.set('Access-Control-Allow-Credentials', 'true');
    context.res.headers.append('Vary', 'Origin');

    const already = context.res.headers.get('Access-Control-Expose-Headers') ?? '';
    const exposed = new Set(
      [...already.split(','), ...EXPOSED_HEADERS].map((one) => one.trim()).filter(Boolean),
    );

    context.res.headers.set('Access-Control-Expose-Headers', [...exposed].join(', '));
  });

export { allowCrossOriginClients, ALLOWED_HEADERS, EXPOSED_HEADERS };
