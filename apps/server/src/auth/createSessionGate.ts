import { createMiddleware } from 'hono/factory';
import { isPublicRoute } from '@ValenceServer/auth/isPublicRoute';
import { readSessionOnce } from '@ValenceServer/auth/readSessionOnce';
import type { MiddlewareHandler } from 'hono';
import type { ValenceAuth } from '@ValenceServer/auth/Auth';

type SessionGateOptions = {
  auth: ValenceAuth;
  showsFaces: () => Promise<boolean>;
  shareGate?: MiddlewareHandler;
};

/**
 * Middleware that requires a session for everything the allowlist does not excuse.
 *
 * Where a share gate is given, somebody with no session is handed to it rather than refused
 * outright — that is how a link works for a guest with no account. It runs only after the session
 * has been looked for and not found, so a share can never widen what somebody signed in already
 * has, and a signed-in request never touches it at all.
 *
 * Whether the faces are open is asked per request rather than read once at startup, so turning the
 * setting off shuts them for the next request instead of at the next restart.
 *
 * @param auth - The authentication layer to resolve the session against.
 * @param showsFaces - Whether this server shows who lives here before anybody has signed in.
 * @param shareGate - What to try for a request carrying no session, where sharing is enabled.
 * @returns The middleware.
 */
const createSessionGate = ({ auth, showsFaces, shareGate }: SessionGateOptions) =>
  createMiddleware(async (context, next) => {
    if (isPublicRoute(context.req.method, context.req.path, await showsFaces())) {
      await next();

      return;
    }

    const session = await readSessionOnce(auth, context.req.raw.headers);

    if (session === null) {
      if (shareGate === undefined) {
        return context.json({ error: 'Nobody is signed in.' }, 401);
      }

      return shareGate(context, next);
    }

    await next();

    return;
  });

export type { SessionGateOptions };

export { createSessionGate };
