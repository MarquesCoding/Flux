import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signedInApp } from '@ValenceServer/auth/signUpForTest';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from './createMemorySubtitleService';

const BASE = 'http://localhost:8420';
const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const SUB_RIP = '1\n00:00:01,000 --> 00:00:03,000\nHello\n';

const SCRIPT = [
  '[Script Info]',
  'PlayResX: 1920',
  'PlayResY: 1080',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, Alignment',
  'Style: Sign,Impact,72,&H000000FF,7',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, Text',
  'Dialogue: 0,0:00:10.00,0:00:14.00,Sign,,{\\pos(1440,216)}CLOSED',
  'Dialogue: 0,0:00:20.00,0:00:22.00,Sign,,{\\an2}Spoken aloud',
].join('\n');

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
          {
            path: '/media/Arrival (2016).ja.ass',
            language: 'ja',
            label: '日本語',
            format: 'ass',
            contents: SCRIPT,
          },
        ],
      }),
    }),
  );
};

const TrackListSchema = z.object({
  tracks: z.array(z.object({ id: z.string(), label: z.string(), language: z.string().nullable() })),
});

const CueListSchema = z.object({
  cues: z.array(
    z.object({
      from: z.number(),
      to: z.number(),
      spans: z.array(z.object({ text: z.string(), colour: z.string().nullable() })),
      alignment: z.number(),
      position: z.object({ x: z.number(), y: z.number() }).nullable(),
      isSign: z.boolean(),
    }),
  ),
});

describe('subtitle tracks', () => {
  it('lists the tracks beside an item', async () => {
    const response = await build().request(`${BASE}/api/media/${MEDIA_ID}/subtitles`);
    const body = TrackListSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.tracks.map((track) => track.label)).toEqual([
      'English',
      'Français (forced)',
      '日本語',
    ]);
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

  it('serves a script as lines that keep where they go and what they wore', async () => {
    const app = build();
    const listed = TrackListSchema.parse(
      await (await app.request(`${BASE}/api/media/${MEDIA_ID}/subtitles`)).json(),
    );

    const response = await app.request(
      `${BASE}/api/media/${MEDIA_ID}/subtitles/${listed.tracks[2]?.id ?? ''}/cues`,
    );

    const body = CueListSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.cues).toHaveLength(2);
    expect(body.cues[0]).toMatchObject({ from: 10, to: 14, isSign: true });
    expect(body.cues[0]?.position?.x).toBeCloseTo(0.75, 3);
    expect(body.cues[0]?.spans[0]).toMatchObject({ text: 'CLOSED', colour: '#ff0000' });
  });

  it('calls a line put at the bottom centre dialogue, whatever style it names', async () => {
    const app = build();
    const listed = TrackListSchema.parse(
      await (await app.request(`${BASE}/api/media/${MEDIA_ID}/subtitles`)).json(),
    );

    const body = CueListSchema.parse(
      await (
        await app.request(
          `${BASE}/api/media/${MEDIA_ID}/subtitles/${listed.tracks[2]?.id ?? ''}/cues`,
        )
      ).json(),
    );

    expect(body.cues[1]).toMatchObject({ isSign: false, alignment: 2 });
  });

  it('lines a script up with a stream that starts partway in', async () => {
    const app = build();
    const listed = TrackListSchema.parse(
      await (await app.request(`${BASE}/api/media/${MEDIA_ID}/subtitles`)).json(),
    );

    const body = CueListSchema.parse(
      await (
        await app.request(
          `${BASE}/api/media/${MEDIA_ID}/subtitles/${listed.tracks[2]?.id ?? ''}/cues?from=12`,
        )
      ).json(),
    );

    expect(body.cues).toHaveLength(2);
    expect(body.cues[0]).toMatchObject({ from: 0, to: 2 });
    expect(body.cues[1]).toMatchObject({ from: 8, to: 10 });
  });

  it('refuses a styled reading of a track that carries no styling', async () => {
    const app = build();
    const listed = TrackListSchema.parse(
      await (await app.request(`${BASE}/api/media/${MEDIA_ID}/subtitles`)).json(),
    );

    const response = await app.request(
      `${BASE}/api/media/${MEDIA_ID}/subtitles/${listed.tracks[0]?.id ?? ''}/cues`,
    );

    expect(response.status).toBe(404);
  });

  it('still serves a script as WebVTT, which is what a floating window reads', async () => {
    const app = build();
    const listed = TrackListSchema.parse(
      await (await app.request(`${BASE}/api/media/${MEDIA_ID}/subtitles`)).json(),
    );

    const text = await (
      await app.request(`${BASE}/api/media/${MEDIA_ID}/subtitles/${listed.tracks[2]?.id ?? ''}`)
    ).text();

    expect(text.startsWith('WEBVTT')).toBe(true);
    expect(text).toContain('CLOSED');
    expect(text).not.toContain('\\pos');
  });
});
