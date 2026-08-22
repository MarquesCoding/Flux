import { describe, expect, it, vi } from 'vitest';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator, TEST_ORIGIN } from '@ValenceServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@ValenceServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { createMemoryProfileService } from '@ValenceServer/profiles/createMemoryProfileService';

/**
 * A server that counts how often it works out who is calling.
 */
const counting = async () => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();
  const resolved = vi.spyOn(auth.api, 'getSession');

  const app = createApp({
    auth,
    settings,
    permissions,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
    profiles: createMemoryProfileService(),
  });

  const cookie = await signUpForTest(app);

  await makeAdministrator(permissions, store.user[0]?.id ?? '');

  resolved.mockClear();

  const request = (path: string) =>
    app.request(`${TEST_ORIGIN}${path}`, { headers: { cookie, origin: TEST_ORIGIN } });

  return { request, resolved };
};

describe('working out who is calling', () => {
  for (const path of [
    '/api/libraries',
    '/api/keys',
    '/api/profiles',
    '/api/progress',
    '/api/favourites',
    '/api/roles',
  ]) {
    it(`asks once for ${path}, however many parts of it want to know`, async () => {
      const { request, resolved } = await counting();

      await request(path);

      expect(resolved).toHaveBeenCalledTimes(1);
    });
  }

  it('asks once again for the next request rather than reusing the last', async () => {
    const { request, resolved } = await counting();

    await request('/api/libraries');
    await request('/api/libraries');

    expect(resolved).toHaveBeenCalledTimes(2);
  });
});
