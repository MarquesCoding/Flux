import { describe, expect, it, vi } from 'vitest';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator, TEST_ORIGIN } from '@FluxServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryProfileService } from '@FluxServer/profiles/createMemoryProfileService';

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
