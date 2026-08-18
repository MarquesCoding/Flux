import { describe, expect, it } from 'vitest';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@FluxServer/ratings/createMemoryRatingService';
import { createMemoryShareService } from '@FluxServer/sharing/createMemoryShareService';
import { createShareSessions } from '@FluxServer/sharing/createShareSessions';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { DEFAULT_ROLE_NAME } from '@FluxCore/functions/defaultRoles';
import { AdminShareListSchema, CreatedShareSchema } from '@FluxContracts/schemas/Share';
import type { NewShare } from '@FluxContracts/schemas/Share';
import { z } from 'zod';

const SessionAccountSchema = z.object({ user: z.object({ id: z.string() }) });
import type { MediaDetail } from '@FluxContracts/schemas/Library';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';

const BASE = 'http://localhost:8420';
const LIBRARY_ID = '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f';
const FILM = '9c858901-8a57-4791-81fe-4c455b099bc9';
const OTHER = '00000000-0000-4000-8000-00000000abcd';
const SHOW = '5d3e2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

const playable = (id: string, title: string): MediaItem => ({
  id,
  title,
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'h264',
  videoRange: 'SDR',
  videoBitDepth: 8,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 1920,
  height: 1080,
  bitrateKbps: 8000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
});

const A_BROWSER = {
  schemaVersion: 1,
  name: 'Browser',
  maxWidth: 1920,
  maxHeight: 1080,
  maxBitrateKbps: 8000,
  maxAudioChannels: 2,
  supportedVideoRanges: ['SDR'],
  tenBitVideoCodecs: [],
  maxVideoLevels: {},
  canPlayInterlaced: true,
  canPlayAnamorphic: true,
  canRotate: true,
  unsupportedAudioProfiles: [],
  supportedSubtitleFormats: ['webvtt'],
  directPlayProfiles: [{ container: 'mp4', videoCodecs: ['h264'], audioCodecs: ['aac'] }],
  transcodingProfiles: [
    { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
  ],
};

const item = (over: Partial<MediaDetail> = {}): MediaDetail =>
  ({
    id: FILM,
    libraryId: LIBRARY_ID,
    title: 'Arrival',
    year: 2016,
    container: 'mkv',
    durationSeconds: 7200,
    videoCodec: 'hevc',
    videoRange: 'SDR',
    videoBitDepth: 8,
    canCopySegments: true,
    videoLevel: null,
    videoFrameRate: null,
    videoIsInterlaced: false,
    videoRefFrames: null,
    videoPixelAspect: null,
    videoRotationDegrees: null,
    width: 1920,
    height: 1080,
    bitrateKbps: 8000,
    audioStreams: [],
    subtitleStreams: [],
    addedAt: '2026-08-10T00:00:00.000Z',
    metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false },
    ...over,
  }) satisfies MediaDetail;

const build = () => {
  const { auth, settings } = createMemoryAuth();
  const permissions = createMemoryPermissionService();
  const shares = createMemoryShareService({
    shares: [],
    titles: { [FILM]: 'Arrival', [OTHER]: 'Nocturnal Animals', [SHOW]: 'The Bear' },
    names: { 'somebody-else': 'Ada' },
  });

  const told: { accountId: string; title: string; byName: string }[] = [];

  const app = createApp({
    auth,
    settings,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService({
      libraries: [
        {
          id: LIBRARY_ID,
          name: 'Films',
          kind: 'movies',
          path: '/media/films',
          itemCount: 2,
          lastScannedAt: null,
          defaultAudioLanguage: null,
          filesAtOnce: null,
        },
      ],
      media: [item(), item({ id: OTHER, title: 'Nocturnal Animals' })],
    }),
    playback: createMemoryPlaybackService({
      media: { [FILM]: playable(FILM, 'Arrival'), [OTHER]: playable(OTHER, 'Nocturnal Animals') },
      sessions: {},
    }),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    profiles: createMemoryProfileService(),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
    shares,
    shareSessions: createShareSessions(),
    permissions,
    sayALinkWasWithdrawn: (one) => {
      told.push(one);

      return Promise.resolve();
    },
  });

  return { app, shares, permissions, told };
};

/**
 * Somebody signed in and holding the role everybody in the house gets, which is what the real server
 * gives a new account and what carries the permission to share.
 */
const signedIn = async (built: ReturnType<typeof build>): Promise<string> => {
  const response = await built.app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(CREDENTIALS),
  });

  const cookie = response.headers.getSetCookie()[0]?.split(';')[0] ?? '';

  const session = await built.app.request(`${BASE}/api/auth/get-session`, {
    headers: { cookie, origin: BASE },
  });

  const said = SessionAccountSchema.safeParse(await session.json());
  const member = built.permissions.state.roles.find((one) => one.name === DEFAULT_ROLE_NAME);

  if (said.success && member !== undefined) {
    built.permissions.state.assignments[said.data.user.id] = [member.id];
  }

  return cookie;
};

/**
 * Somebody signed in and allowed to look after everybody's links, which is what the Manager role
 * carries on a real server.
 */
const signedInToManage = async (built: ReturnType<typeof build>): Promise<string> => {
  const cookie = await signedIn(built);

  const session = await built.app.request(`${BASE}/api/auth/get-session`, {
    headers: { cookie, origin: BASE },
  });

  const said = SessionAccountSchema.safeParse(await session.json());

  const role = await built.permissions.createRole({
    name: 'Looks after links',
    position: 50,
    permissions: ['sharing.link', 'sharing.manage'],
  });

  if (said.success) {
    built.permissions.state.assignments[said.data.user.id] = [role.id];
  }

  return cookie;
};

/**
 * A link handed out over HTTP, with the token it was given once.
 */
const shared = async (
  app: ReturnType<typeof build>['app'],
  cookie: string,
  body: NewShare = { kind: 'item', mediaId: FILM },
) => {
  const response = await app.request(`${BASE}/api/shares`, {
    method: 'POST',
    headers: { cookie, origin: BASE, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return CreatedShareSchema.parse(await response.json());
};

/**
 * A guest arriving with a link, holding whatever cookies the server gave them.
 */
const opened = async (app: ReturnType<typeof build>['app'], token: string) => {
  const response = await app.request(`${BASE}/api/share/${token}`, { headers: { origin: BASE } });
  const jar = response.headers
    .getSetCookie()
    .map((one) => one.split(';')[0] ?? '')
    .join('; ');

  return { response, jar };
};

describe('handing out a link', () => {
  it('will not let somebody who is not signed in hand one out', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'item', mediaId: FILM }),
    });

    expect(response.status).toBe(401);
  });

  it('hands back a token once', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);

    expect((await shared(app, cookie)).token).toBeTruthy();
  });

  it('never shows the token again', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);

    const made = await shared(app, cookie);

    const listed = await app.request(`${BASE}/api/shares`, { headers: { cookie, origin: BASE } });

    expect(JSON.stringify(await listed.json())).not.toContain(made.token);
  });

  it('will not share something that is not there', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);

    const response = await app.request(`${BASE}/api/shares`, {
      method: 'POST',
      headers: { cookie, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'item', mediaId: '00000000-0000-4000-8000-000000000000' }),
    });

    expect(response.status).toBe(404);
  });
});

describe('opening a link as somebody with no account', () => {
  it('opens what was shared', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);

    const { response } = await opened(app, made.token);

    expect(response.status).toBe(200);
  });

  it('says nothing doing for a token nobody was given', async () => {
    const { app } = build();

    expect((await app.request(`${BASE}/api/share/not-a-token`)).status).toBe(404);
  });

  it('stops working the moment it is withdrawn', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);

    await app.request(`${BASE}/api/shares/${made.id}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    const { response } = await opened(app, made.token);

    expect(response.status).toBe(410);
  });

  it('stops working once it has expired', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie, {
      kind: 'item',
      mediaId: FILM,
      expiresAt: '2020-01-01T00:00:00.000Z',
    });

    const { response } = await opened(app, made.token);

    expect(response.status).toBe(410);
  });

  it('remembers a guest past the end of their browsing, so tomorrow they are the same person', async () => {
    const built = build();
    const cookie = await signedIn(built);
    const made = await shared(built.app, cookie, { kind: 'item', mediaId: FILM, viewCap: 1 });

    const response = await built.app.request(`${BASE}/api/share/${made.token}`, {
      headers: { origin: BASE },
    });

    const joiner = response.headers
      .getSetCookie()
      .find((one) => one.startsWith('flux_share_joiner='));

    expect(joiner).toMatch(/Max-Age=\d+/);
  });

  it('never remembers a guest for longer than the link they hold', async () => {
    const built = build();
    const cookie = await signedIn(built);

    const made = await shared(built.app, cookie, {
      kind: 'item',
      mediaId: FILM,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const response = await built.app.request(`${BASE}/api/share/${made.token}`, {
      headers: { origin: BASE },
    });

    const joiner =
      response.headers.getSetCookie().find((one) => one.startsWith('flux_share_joiner=')) ?? '';

    const keptFor = Number(/Max-Age=(\d+)/.exec(joiner)?.[1] ?? '0');

    expect(keptFor).toBeGreaterThan(0);
    expect(keptFor).toBeLessThanOrEqual(60);
  });

  it('lets the one person it was meant for come back to it', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie, { kind: 'item', mediaId: FILM, viewCap: 1 });

    const first = await opened(app, made.token);

    expect(first.response.status).toBe(200);

    const again = await app.request(`${BASE}/api/share/${made.token}`, {
      headers: { cookie: first.jar, origin: BASE },
    });

    expect(again.status).toBe(200);
  });

  it('lets that person keep watching, rather than refusing their own segments', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie, { kind: 'item', mediaId: FILM, viewCap: 1 });

    const { jar } = await opened(app, made.token);

    const response = await app.request(`${BASE}/api/media/${FILM}`, {
      headers: { cookie: jar, origin: BASE },
    });

    expect(response.status).toBe(200);
  });

  it('stops working once it has been opened as often as it was meant to be', async () => {
    const built = build();
    const { app, shares } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie, { kind: 'item', mediaId: FILM, viewCap: 1 });

    await shares.join(made.id, 'somebody-else');

    const { response } = await opened(app, made.token);

    expect(response.status).toBe(410);
  });
});

/**
 * Starts playing as a guest holding a link, and answers with the session the server named. The name
 * is the server's to choose — `direct-<item>` for a file played as it is, the media service's own
 * name for a transcode — and the guest has to be able to fetch a manifest under whichever it picked.
 */
const playing = async (
  app: ReturnType<typeof build>['app'],
  jar: string,
  mediaId = FILM,
): Promise<string> => {
  const response = await app.request(`${BASE}/api/playback/${mediaId}/session`, {
    method: 'POST',
    headers: { cookie: jar, origin: BASE, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceProfile: A_BROWSER }),
  });

  return z.object({ sessionId: z.string() }).parse(await response.json()).sessionId;
};

describe('what a guest may reach', () => {
  it('reaches what was shared', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);
    const { jar } = await opened(app, made.token);

    const response = await app.request(`${BASE}/api/media/${FILM}`, {
      headers: { cookie: jar, origin: BASE },
    });

    expect(response.status).toBe(200);
  });

  it('fetches the manifest of the session its own link started', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);
    const { jar } = await opened(app, made.token);

    const sessionId = await playing(app, jar);

    const response = await app.request(
      `${BASE}/api/playback/session/${encodeURIComponent(sessionId)}/index.m3u8`,
      { headers: { cookie: jar, origin: BASE } },
    );

    expect(response.status).toBe(200);
  });

  it('never reaches a session belonging to somebody else’s link', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);

    const mine = await shared(app, cookie);
    const theirs = await shared(app, cookie, { kind: 'item', mediaId: OTHER });

    const { jar: myJar } = await opened(app, mine.token);
    const { jar: theirJar } = await opened(app, theirs.token);

    const theirSession = await playing(app, theirJar, OTHER);

    const response = await app.request(
      `${BASE}/api/playback/session/${encodeURIComponent(theirSession)}/index.m3u8`,
      { headers: { cookie: myJar, origin: BASE } },
    );

    expect(response.status).toBe(403);
  });

  it('never reaches anything else in the library', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);
    const { jar } = await opened(app, made.token);

    const response = await app.request(`${BASE}/api/media/${OTHER}`, {
      headers: { cookie: jar, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('never reaches the library listing', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);
    const { jar } = await opened(app, made.token);

    const response = await app.request(`${BASE}/api/libraries`, {
      headers: { cookie: jar, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('never reaches the admin area', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);
    const { jar } = await opened(app, made.token);

    const response = await app.request(`${BASE}/api/admin/accounts`, {
      headers: { cookie: jar, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('never hands out another link of its own', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);
    const { jar } = await opened(app, made.token);

    const response = await app.request(`${BASE}/api/shares`, {
      method: 'POST',
      headers: { cookie: jar, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'item', mediaId: OTHER }),
    });

    expect(response.status).toBe(403);
  });

  it('reaches nothing at all without the cookie the link gave it', async () => {
    const { app } = build();

    expect((await app.request(`${BASE}/api/media/${FILM}`)).status).toBe(401);
  });

  it('stops reaching anything the moment the link is withdrawn', async () => {
    const built = build();
    const { app } = built;
    const cookie = await signedIn(built);
    const made = await shared(app, cookie);
    const { jar } = await opened(app, made.token);

    expect(
      (await app.request(`${BASE}/api/media/${FILM}`, { headers: { cookie: jar, origin: BASE } }))
        .status,
    ).toBe(200);

    await app.request(`${BASE}/api/shares/${made.id}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    const after = await app.request(`${BASE}/api/media/${FILM}`, {
      headers: { cookie: jar, origin: BASE },
    });

    expect(after.status).toBe(410);
  });
});

describe('withdrawing a link', () => {
  it('will not let somebody withdraw a link that is not theirs', async () => {
    const built = build();
    const { app, shares } = built;
    const cookie = await signedIn(built);

    const theirs = await shares.create('somebody-else', { kind: 'item', mediaId: FILM });

    const response = await app.request(`${BASE}/api/shares/${theirs?.id ?? ''}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(404);
  });

  it('lists only what this account handed out', async () => {
    const built = build();
    const { app, shares } = built;
    const cookie = await signedIn(built);

    await shared(app, cookie);
    await shares.create('somebody-else', { kind: 'item', mediaId: OTHER });

    const response = await app.request(`${BASE}/api/shares`, {
      headers: { cookie, origin: BASE },
    });

    const listed = await response.json();

    expect(JSON.stringify(listed)).not.toContain('Nocturnal Animals');
  });
});

describe('what a link tells the rest of the internet', () => {
  it('asks not to be indexed, since a link is a credential rather than a page', async () => {
    const built = build();
    const cookie = await signedIn(built);
    const made = await shared(built.app, cookie);

    const response = await built.app.request(`${BASE}/api/share/${made.token}`, {
      headers: { origin: BASE },
    });

    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('sends no referrer, since the token is in the address and would travel with it', async () => {
    const built = build();

    const response = await built.app.request(`${BASE}/api/health`, { headers: { origin: BASE } });

    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});

describe('looking after everybody’s links', () => {
  it('refuses somebody who may share but may not look after what others shared', async () => {
    const built = build();
    const cookie = await signedIn(built);

    const response = await built.app.request(`${BASE}/api/admin/shares`, {
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(403);
  });

  it('lists what everybody handed out, and says who handed each one out', async () => {
    const built = build();
    const cookie = await signedInToManage(built);

    await shared(built.app, cookie);
    await built.shares.create('somebody-else', { kind: 'item', mediaId: OTHER });

    const response = await built.app.request(`${BASE}/api/admin/shares`, {
      headers: { cookie, origin: BASE },
    });

    const listed = AdminShareListSchema.parse(await response.json());

    expect(listed.shares).toHaveLength(2);
    expect(listed.shares.map((one) => one.title)).toContain('Nocturnal Animals');
    expect(listed.shares.find((one) => one.title === 'Nocturnal Animals')?.createdByName).toBe(
      'Ada',
    );
  });

  it('withdraws somebody else’s link, and the link stops working at once', async () => {
    const built = build();
    const cookie = await signedInToManage(built);

    const theirs = await built.shares.create('somebody-else', { kind: 'item', mediaId: FILM });

    const response = await built.app.request(`${BASE}/api/admin/shares/${theirs?.id ?? ''}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);

    const { response: asGuest } = await opened(built.app, theirs?.token ?? '');

    expect(asGuest.status).toBe(410);
  });

  it('tells whoever made the link that it was withdrawn, and by whom', async () => {
    const built = build();
    const cookie = await signedInToManage(built);

    const theirs = await built.shares.create('somebody-else', { kind: 'item', mediaId: FILM });

    await built.app.request(`${BASE}/api/admin/shares/${theirs?.id ?? ''}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(built.told).toEqual([
      { accountId: 'somebody-else', title: 'Arrival', byName: CREDENTIALS.name },
    ]);
  });

  it('says nothing to somebody withdrawing their own link', async () => {
    const built = build();
    const cookie = await signedInToManage(built);

    const mine = await shared(built.app, cookie);

    await built.app.request(`${BASE}/api/admin/shares/${mine.id}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(built.told).toEqual([]);
  });

  it('withdraws a link once, so a second attempt says there is nothing to withdraw', async () => {
    const built = build();
    const cookie = await signedInToManage(built);

    const theirs = await built.shares.create('somebody-else', { kind: 'item', mediaId: FILM });

    await built.app.request(`${BASE}/api/admin/shares/${theirs?.id ?? ''}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    const again = await built.app.request(`${BASE}/api/admin/shares/${theirs?.id ?? ''}`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(again.status).toBe(404);
    expect(built.told).toHaveLength(1);
  });
});
