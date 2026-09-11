import { describe, expect, it } from 'vitest';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator } from '@ValenceServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@ValenceServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemoryProfileService } from '@ValenceServer/profiles/createMemoryProfileService';
import { createPresenceService } from '@ValenceServer/presence/PresenceService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import type { DirectoryRead, FolderDisk } from '@ValenceServer/folders/FolderDisk';

const BASE = 'http://localhost:8420';

const CREDENTIALS = {
  name: 'Marques',
  email: 'marques@valence.local',
  password: 'a-long-enough-password',
};

const TREE: Record<string, DirectoryRead> = {
  '/media': {
    kind: 'read',
    entries: [
      { name: 'films', isDirectory: true, isSymbolicLink: false },
      { name: '.trash', isDirectory: true, isSymbolicLink: false },
    ],
  },
  '/root': { kind: 'unreadable' },
};

const disk: FolderDisk = {
  readDirectory: (path) => Promise.resolve(TREE[path] ?? { kind: 'missing' }),
  isDirectory: () => Promise.resolve(false),
  roots: () => Promise.resolve(['/', '/Volumes']),
};

const build = () => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();

  const app = createApp({
    auth,
    settings,
    permissions,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService({ libraries: [], media: [] }),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
    profiles: createMemoryProfileService(),
    presence: createPresenceService(),
    folderDisk: disk,
  });

  return { app, store, permissions };
};

/**
 * Signs somebody up, and makes them an administrator where asked.
 *
 * @param built - The app, the account store and the permissions.
 * @param isAdministrator - Whether to give them the Administrator role.
 * @returns Their session cookie.
 */
const signIn = async (
  { app, store, permissions }: ReturnType<typeof build>,
  isAdministrator: boolean,
): Promise<string> => {
  const cookie = await signUpForTest(app, CREDENTIALS);
  const user = store.user[0];

  if (isAdministrator && user !== undefined) {
    user.role = 'admin';

    await makeAdministrator(permissions, user.id);
  }

  return cookie;
};

/**
 * Asks the server for the folders inside one, as a signed-in account.
 *
 * @param built - The app.
 * @param cookie - Whose session to ask with.
 * @param path - The folder to ask about, or nothing for the places to start from.
 * @returns The answer.
 */
const ask = (built: ReturnType<typeof build>, cookie: string, path?: string): Promise<Response> =>
  Promise.resolve(
    built.app.request(
      `${BASE}/api/admin/folders${path === undefined ? '' : `?${new URLSearchParams({ path }).toString()}`}`,
      { headers: { cookie, origin: BASE } },
    ),
  );

describe('choosing a folder over HTTP', () => {
  it('shows nobody the disk who could not add a library', async () => {
    const built = build();
    const cookie = await signIn(built, false);

    expect((await ask(built, cookie)).status).toBe(403);
  });

  it('offers an administrator the places to start from', async () => {
    const built = build();
    const cookie = await signIn(built, true);

    const response = await ask(built, cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      path: null,
      parent: null,
      folders: [
        { name: '/', path: '/' },
        { name: '/Volumes', path: '/Volumes' },
      ],
      isTruncated: false,
    });
  });

  it('lists the folders inside one, leaving out the hidden ones', async () => {
    const built = build();
    const cookie = await signIn(built, true);

    const response = await ask(built, cookie, '/media');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      path: '/media',
      parent: '/',
      folders: [{ name: 'films', path: '/media/films' }],
      isTruncated: false,
    });
  });

  it('says a folder that is not there is not found', async () => {
    const built = build();
    const cookie = await signIn(built, true);

    expect((await ask(built, cookie, '/nowhere')).status).toBe(404);
  });

  it('refuses a folder it may not read, rather than calling it empty', async () => {
    const built = build();
    const cookie = await signIn(built, true);

    const response = await ask(built, cookie, '/root');

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Valence is not allowed to read that folder.' });
  });

  it('refuses a path that does not start from the root', async () => {
    const built = build();
    const cookie = await signIn(built, true);

    expect((await ask(built, cookie, 'media/films')).status).toBe(400);
  });
});
