import { createMiddleware } from 'hono/factory';
import { isPublicRoute } from '@FluxServer/auth/isPublicRoute';
import { readSessionOnce } from '@FluxServer/auth/readSessionOnce';
import type { FluxAuth } from '@FluxServer/auth/Auth';

/**
 * Middleware that requires a session for everything the allowlist does not excuse.
 *
 * @param auth The authentication layer to resolve the session against.
 */
const createSessionGate = (auth: FluxAuth) =>
  createMiddleware(async (context, next) => {
    if (isPublicRoute(context.req.method, context.req.path)) {
      await next();

      return;
    }

    const session = await readSessionOnce(auth, context.req.raw.headers);

    if (session === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await next();

    return;
  });

export { createSessionGate };
