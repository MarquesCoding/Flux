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
import { CreatedShareSchema } from '@FluxContracts/schemas/Share';
import type { NewShare } from '@FluxContracts/schemas/Share';
import { z } from 'zod';

const SessionAccountSchema = z.object({ user: z.object({ id: z.string() }) });
import type { MediaDetail } from '@FluxContracts/schemas/Library';

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
  });

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
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    profiles: createMemoryProfileService(),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
    shares,
    shareSessions: createShareSessions(),
    permissions,
  });

  return { app, shares, permissions };
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
