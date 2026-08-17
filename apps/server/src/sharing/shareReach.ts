import type { ShareKind } from '@FluxContracts/schemas/Share';

type ShareScope = {
  kind: ShareKind;
  mediaId: string | null;
  seriesId: string | null;
};

type ShareRequest = {
  method: string;
  path: string;
};

type ShareReach =
  | { kind: 'allowed' }
  | { kind: 'needsItem'; mediaId: string }
  | { kind: 'needsSession'; sessionId: string }
  | { kind: 'refused' };

const ID = '[0-9a-fA-F-]{36}';

const ITEM_ROUTES: readonly RegExp[] = [
  new RegExp(`^/api/media/(${ID})$`),
  new RegExp(`^/api/media/(${ID})/image/[a-z]+$`),
  new RegExp(`^/api/media/(${ID})/segments$`),
  new RegExp(`^/api/media/(${ID})/subtitles$`),
  new RegExp(`^/api/media/(${ID})/subtitles/[^/]+$`),
  new RegExp(`^/api/playback/(${ID})/session$`),
  new RegExp(`^/api/playback/(${ID})/explain$`),
  new RegExp(`^/api/playback/(${ID})/file$`),
  new RegExp(`^/api/playback/(${ID})/trickplay$`),
  new RegExp(`^/api/playback/(${ID})/frame$`),
];

const SESSION_ROUTES: readonly RegExp[] = [
  new RegExp(`^/api/playback/session/(${ID})$`),
  new RegExp(`^/api/playback/session/(${ID})/heartbeat$`),
  new RegExp(`^/api/playback/session/(${ID})/[^/]+$`),
];

const OPEN_TO_A_GUEST: readonly RegExp[] = [/^\/api\/share\/[^/]+$/, /^\/api\/health$/];

/**
 * Decides what a guest holding a share link may ask for. Everything is refused unless it is named
 * here, so a route added later is closed to a share until somebody deliberately opens it — the
 * opposite way round from listing what a share may not reach, which fails open the moment the
 * library grows a new endpoint.
 *
 * Two kinds of thing still need checking after this: a request naming an item has to be checked
 * against what the share covers, and a request naming a session has to be checked against the
 * sessions that share itself started. This says which, rather than deciding either, so that the
 * check happens against live state rather than against a path.
 *
 * @param request - What is being asked for.
 * @returns Whether it is allowed outright, refused outright, or allowed subject to a check.
 */
const reachOf = (request: ShareRequest): ShareReach => {
  if (OPEN_TO_A_GUEST.some((route) => route.test(request.path))) {
    return { kind: 'allowed' };
  }

  for (const route of ITEM_ROUTES) {
    const found = route.exec(request.path);

    if (found?.[1] !== undefined) {
      return { kind: 'needsItem', mediaId: found[1] };
    }
  }

  for (const route of SESSION_ROUTES) {
    const found = route.exec(request.path);

    if (found?.[1] !== undefined) {
      return { kind: 'needsSession', sessionId: found[1] };
    }
  }

  return { kind: 'refused' };
};

/**
 * Whether a share covers a given item. A share of one item covers that item and nothing else; a
 * share of a series covers the episodes of that series and nothing else. Neither is ever a way into
 * the library, into search, or into a title outside what was shared.
 *
 * @param scope - What the share covers.
 * @param item - The item being asked for, and the series it belongs to where it has one.
 * @returns Whether the share covers it.
 */
const covers = (scope: ShareScope, item: { id: string; seriesId: string | null }): boolean =>
  scope.kind === 'item'
    ? scope.mediaId !== null && scope.mediaId === item.id
    : scope.seriesId !== null && scope.seriesId === item.seriesId;

export type { ShareScope, ShareReach, ShareRequest };

export { reachOf, covers };
