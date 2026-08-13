import { createMiddleware } from 'hono/factory';
import { isPublicRoute } from '@FluxServer/auth/isPublicRoute';
import { readSessionOnce } from '@FluxServer/auth/readSessionOnce';
import type { FluxAuth } from '@FluxServer/auth/Auth';

/**
 * Middleware that requires a session for everything the allowlist does not
 * excuse.
 *
 * This is a gate rather than a check each handler makes for itself, and the
 * distinction is the point of it: a handler that has to remember to ask is a
 * handler that can forget, and several of them had — the catalogue, the media
 * files themselves, and every route that reshapes a library were all reachable
 * by anybody who could open the port. Closed by default means the next route
 * added is safe without anybody thinking about it, and opening one is a
 * deliberate line in `isPublicRoute` rather than an omission.
 *
 * Register it before any route: Hono runs middleware in the order it was
 * added, so a gate added afterwards would not cover what came before it.
 * Scope it to `/api`, so that serving the web application never depends on
 * being signed in — a sign-in page behind a sign-in check helps nobody.
 *
 * It answers who somebody is, not what they may do. A route that asks for
 * more than merely being signed in still has to ask — and asks the same
 * reader, so one request resolves its caller once however many times it is
 * asked about.
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
