import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createShareGate, SHARE_COOKIE } from './createShareGate';
import type { ResolvedShare, ShareService } from './ShareService';

const A_SHARE: ResolvedShare = {
  id: 'share-1',
  kind: 'item',
  mediaId: 'film-1',
  seriesId: null,
  title: 'Arrival',
  expiresAt: null,
  viewCap: null,
  views: 0,
  revokedAt: null,
};

const gatedApp = (options: {
  share?: ResolvedShare | null;
  hasJoined?: boolean;
  shareOfSession?: string | null;
  item?: { id: string; seriesId: string | null } | null;
}) => {
  const shares = {
    create: () => Promise.resolve(null),
    list: () => Promise.resolve([]),
    listEverybody: () => Promise.resolve([]),
    revoke: () => Promise.resolve(false),
    revokeAnybody: () => Promise.resolve(null),
    resolve: () => Promise.resolve(options.share === undefined ? A_SHARE : options.share),
    join: () => Promise.resolve(),
    hasJoined: () => Promise.resolve(options.hasJoined ?? false),
  } satisfies ShareService;

  const app = new Hono();

  app.use(
    '*',
    createShareGate({
      shares,
      sessions: {
        claim: () => {},
        shareOf: () => options.shareOfSession ?? null,
        release: () => {},
      },
      itemOf: () =>
        Promise.resolve(
          options.item === undefined ? { id: 'film-1', seriesId: null } : options.item,
        ),
    }),
  );

  app.all('*', (context) => context.json({ reached: true }, 200));

  return app;
};

const holding = (token: string | null) => ({
  headers: token === null ? {} : { cookie: `${SHARE_COOKIE}=${token}` },
});

describe('createShareGate', () => {
  it('refuses somebody holding no link at all', async () => {
    const response = await gatedApp({}).request('/api/health', holding(null));

    expect(response.status).toBe(401);
  });

  it('refuses an empty link rather than looking it up', async () => {
    const response = await gatedApp({}).request('/api/health', holding(''));

    expect(response.status).toBe(401);
  });

  it('says a link that resolves to nothing does not work', async () => {
    const response = await gatedApp({ share: null }).request('/api/health', holding('abc'));

    expect(response.status).toBe(404);
  });

  it('says a withdrawn link no longer works, and why', async () => {
    const response = await gatedApp({
      share: { ...A_SHARE, revokedAt: new Date('2026-01-01T00:00:00.000Z') },
    }).request('/api/health', holding('abc'));

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ ended: 'withdrawn' });
  });

  it('says an expired link no longer works', async () => {
    const response = await gatedApp({
      share: { ...A_SHARE, expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    }).request('/api/health', holding('abc'));

    expect(response.status).toBe(410);
  });

  it('lets a guest reach what is open to them', async () => {
    const response = await gatedApp({}).request('/api/health', holding('abc'));

    expect(response.status).toBe(200);
  });

  it('refuses a route nobody opened to a share', async () => {
    const response = await gatedApp({}).request('/api/admin/shares', holding('abc'));

    expect(response.status).toBe(403);
  });

  it('refuses a session this link did not start', async () => {
    const response = await gatedApp({ shareOfSession: 'another-share' }).request(
      '/api/playback/session/direct-film-1/index.m3u8',
      holding('abc'),
    );

    expect(response.status).toBe(403);
  });

  it('lets through a session this link did start', async () => {
    const response = await gatedApp({ shareOfSession: 'share-1' }).request(
      '/api/playback/session/direct-film-1/index.m3u8',
      holding('abc'),
    );

    expect(response.status).toBe(200);
  });

  it('refuses an item the link does not cover', async () => {
    const response = await gatedApp({ item: { id: 'other', seriesId: null } }).request(
      '/api/media/other',
      holding('abc'),
    );

    expect(response.status).toBe(403);
  });

  it('refuses an item nobody holds', async () => {
    const response = await gatedApp({ item: null }).request('/api/media/other', holding('abc'));

    expect(response.status).toBe(403);
  });
});
