import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { howShareEnded, isShareLive, whyShareEnded } from '@ValenceContracts/schemas/Share';
import { covers, reachOf } from './shareReach';
import type { ShareService } from './ShareService';
import type { ShareSessions } from './createShareSessions';

const SHARE_COOKIE = 'flux_share';

const SHARE_JOINER = 'flux_share_joiner';

type ShareGateOptions = {
  shares: ShareService;
  sessions: ShareSessions;
  itemOf: (mediaId: string) => Promise<{ id: string; seriesId: string | null } | null>;
};

/**
 * Lets somebody holding a share link reach what was shared with them, and refuses everything else.
 * Runs only for a request with no signed-in session, so nothing here can widen what an account
 * already has — a share is a way in for somebody with no account, not a second set of permissions
 * for somebody who has one.
 *
 * Three things are checked on every request rather than once at the start, which is what makes
 * revocation and expiry immediate for a stream already playing:
 *
 * * the link still exists, has not been withdrawn, has not expired, and either has room left or is
 *   being asked for by somebody already let in — a cap counts people rather than requests, so the
 *   person it admitted is not refused by it a moment later;
 * * the route is one a guest may ask for at all, which is decided by naming what is open rather
 *   than what is closed, so a route added later is shut to a share until somebody opens it;
 * * the thing being asked for is inside what the link covers.
 *
 * @param shares - Where links are resolved.
 * @param sessions - Which share started which playback session.
 * @param itemOf - How to look up the item a request names, to check it against the link's scope.
 * @returns The middleware.
 */
const createShareGate = ({ shares, sessions, itemOf }: ShareGateOptions) =>
  createMiddleware(async (context, next) => {
    const token = getCookie(context, SHARE_COOKIE);

    if (token === undefined || token === '') {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const found = await shares.resolve(token);

    if (found === null) {
      return context.json({ error: 'This link does not work.' }, 404);
    }

    const joiner = getCookie(context, SHARE_JOINER);

    const standing = {
      expiresAt: found.expiresAt,
      viewCap: found.viewCap,
      views: found.views,
      revokedAt: found.revokedAt,
      isReturning: joiner !== undefined && (await shares.hasJoined(found.id, joiner)),
    };

    if (!isShareLive(standing, new Date())) {
      return context.json(
        {
          error: whyShareEnded(standing, new Date()) ?? 'This link no longer works.',
          ended: howShareEnded(standing, new Date()) ?? 'withdrawn',
        },
        410,
      );
    }

    const reach = reachOf({ method: context.req.method, path: context.req.path });

    if (reach.kind === 'refused') {
      return context.json({ error: 'That is not part of what was shared.' }, 403);
    }

    if (reach.kind === 'needsSession') {
      if (sessions.shareOf(reach.sessionId) !== found.id) {
        return context.json({ error: 'That is not part of what was shared.' }, 403);
      }

      await next();

      return;
    }

    if (reach.kind === 'needsItem') {
      const item = await itemOf(reach.mediaId);

      if (item === null || !covers(found, item)) {
        return context.json({ error: 'That is not part of what was shared.' }, 403);
      }
    }

    await next();

    return;
  });

export { createShareGate, SHARE_COOKIE };
