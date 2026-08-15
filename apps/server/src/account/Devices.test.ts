import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import type { MediaDetail } from '@FluxContracts/schemas/Library';

const BASE = 'http://localhost:8420';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const LIBRARY_ID = '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f';

const FILM: MediaDetail = {
  id: MEDIA_ID,
  libraryId: LIBRARY_ID,
  title: 'Arrival',
  year: 2016,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  videoBitDepth: 8,
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'truehd', channels: 8, isDefault: true, isAtmos: true }],
  subtitleStreams: [],
  addedAt: '2026-08-10T00:00:00.000Z',
  metadata: { hasPoster: false, hasBackdrop: false, hasLogo: false },
};

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@flux.local',
  password: 'a-long-enough-password',
};

const DeviceListSchema = z.object({
  devices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      address: z.string().nullable(),
      isCurrent: z.boolean(),
    }),
  ),
});

const build = () => {
  const { auth, settings, store } = createMemoryAuth();
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
          itemCount: 1,
          lastScannedAt: null,
          defaultAudioLanguage: null,
          filesAtOnce: null,
        },
      ],
      media: [FILM],
    }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    profiles: createMemoryProfileService(),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
  });

  return { app, store };
};

/**
 * Somebody signed in, and the cookie that says so.
 */
const signedIn = async (app: ReturnType<typeof build>['app']): Promise<string> => {
  const response = await app.request(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(CREDENTIALS),
  });

  return response.headers.getSetCookie()[0]?.split(';')[0] ?? '';
};

const listed = async (app: ReturnType<typeof build>['app'], cookie: string) =>
  DeviceListSchema.parse(
    await (
      await app.request(`${BASE}/api/account/devices`, { headers: { cookie, origin: BASE } })
    ).json(),
  ).devices;

describe('devices over HTTP', () => {
  it('tells somebody who is not signed in nothing about anybody', async () => {
    const { app } = build();

    expect((await app.request(`${BASE}/api/account/devices`)).status).toBe(401);
  });

  it('will not sign anything out for nobody', async () => {
    const { app } = build();

    const response = await app.request(`${BASE}/api/account/devices/whatever`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(401);
  });

  it('lists where this account is signed in', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await expect(listed(app, cookie)).resolves.toHaveLength(1);
  });

  it('marks the one asking, so a viewer knows which they are holding', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    await expect(listed(app, cookie)).resolves.toMatchObject([{ isCurrent: true }]);
  });

  it('never hands out the means to be one of them', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const body = await (
      await app.request(`${BASE}/api/account/devices`, { headers: { cookie, origin: BASE } })
    ).text();

    expect(body).not.toContain(cookie.split('=')[1] ?? 'nothing');
    expect(body).not.toContain('token');
  });

  it('answers the same way for a session it has never heard of', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/account/devices/not-a-session`, {
      method: 'DELETE',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
  });

  it('spares the session doing the asking when signing out everywhere else', async () => {
    const { app } = build();
    const cookie = await signedIn(app);

    const response = await app.request(`${BASE}/api/account/devices/end-others`, {
      method: 'POST',
      headers: { cookie, origin: BASE },
    });

    expect(response.status).toBe(204);
    await expect(listed(app, cookie)).resolves.toMatchObject([{ isCurrent: true }]);
  });

  it('reports the address a session was opened from when one was recorded', async () => {
    const { app, store } = build();
    const cookie = await signedIn(app);
    const held = store.session[0];

    if (held !== undefined) {
      held.ipAddress = '192.168.1.50';
    }

    await expect(listed(app, cookie)).resolves.toMatchObject([{ address: '192.168.1.50' }]);
  });

  it('reports no address for a session opened from somewhere it did not record', async () => {
    const { app, store } = build();
    const cookie = await signedIn(app);
    const held = store.session[0];

    if (held !== undefined) {
      held.ipAddress = null;
    }

    await expect(listed(app, cookie)).resolves.toMatchObject([{ address: null }]);
  });
});
