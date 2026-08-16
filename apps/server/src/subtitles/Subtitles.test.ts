import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { signedInApp } from '@FluxServer/auth/signUpForTest';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@FluxServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from './createMemorySubtitleService';

const BASE = 'http://localhost:8420';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const SUB_RIP = '1\n00:00:01,000 --> 00:00:03,000\nHello\n';

const build = () => {
  const { auth, settings } = createMemoryAuth();

  return signedInApp(
    createApp({
      auth,
      settings,
      countUsers: () => Promise.resolve(1),
      promoteToAdmin: () => Promise.resolve(),
      library: createMemoryLibraryService(),
      playback: createMemoryPlaybackService(),
      segments: createMemorySegmentService(),
      progress: createMemoryWatchProgressService(),
      favourites: createMemoryFavouriteService(),
      ratings: createMemoryRatingService(),
      subtitles: createMemorySubtitleService({
        [MEDIA_ID]: [
          {
            path: '/media/Arrival (2016).en.srt',
            language: 'en',
            label: 'English',
            format: 'srt',
            contents: SUB_RIP,
          },
          {
            path: '/media/Arrival (2016).fr.forced.srt',
            language: 'fr',
            label: 'Français (forced)',
            format: 'srt',
            contents: SUB_RIP,
            isForced: true,
          },
        ],
      }),
    }),
  );
};

const TrackListSchema = z.object({
  tracks: z.array(z.object({ id: z.string(), label: z.string(), language: z.string().nullable() })),
});

describe('subtitle tracks', () => {
  it('lists the tracks beside an item', async () => {
    const response = await build().request(`${BASE}/api/media/${MEDIA_ID}/subtitles`);
    const body = TrackListSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.tracks.map((track) => track.label)).toEqual(['English', 'Français (forced)']);
  });

  it('reports an unknown item rather than an empty list', async () => {
    const response = await build().request(`${BASE}/api/media/${MISSING_ID}/subtitles`);

    expect(response.status).toBe(404);
  });

  it('serves a track as WebVTT whatever it was on disk', async () => {
    const app = build();
    const listed = TrackListSchema.parse(
      await (await app.request(`${BASE}/api/media/${MEDIA_ID}/subtitles`)).json(),
    );

    const response = await app.request(
      `${BASE}/api/media/${MEDIA_ID}/subtitles/${listed.tracks[0]?.id ?? ''}`,
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/vtt');
    expect(text.startsWith('WEBVTT')).toBe(true);
    expect(text).toContain('00:00:01.000 --> 00:00:03.000');
  });

  it('reports a track that does not exist', async () => {
    const response = await build().request(
      `${BASE}/api/media/${MEDIA_ID}/subtitles/not-a-real-track`,
    );

    expect(response.status).toBe(404);
  });

  it('documents itself in the specification', async () => {
    const response = await build().request(`${BASE}/api/openapi.json`);
    const body = await response.json();

    expect(body).toHaveProperty(['paths', '/api/media/{mediaId}/subtitles', 'get']);
    expect(body).toHaveProperty(['paths', '/api/media/{mediaId}/subtitles/{trackId}', 'get']);
  });
});
