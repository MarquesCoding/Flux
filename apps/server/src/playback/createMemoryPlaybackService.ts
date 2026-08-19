import { negotiatePlayback } from '@FluxCore/functions/negotiatePlayback';
import { resolveQualityStep } from '@FluxCore/functions/resolveQualityStep';
import { describePlaybackMode } from '@FluxContracts/functions/describePlaybackMode';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';
import type { PlaybackService } from './PlaybackService';

type MemoryPlaybackState = {
  media: Record<string, MediaItem>;
  sessions: Record<string, Record<string, string>>;
  unsupported?: boolean;
};

/**
 * Builds a stream of one chunk, standing in for a file arriving from the media service so the routes
 * can be exercised without one.
 *
 * @param content - What the stream should carry.
 * @returns The stream.
 */
const streamOf = (content: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start: (controller) => {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  });

/**
 * Playback held in memory, so the routes can be exercised without a media service — sessions start,
 * heartbeat and stop, and files arrive, without anything being encoded.
 *
 * @param state - Any sessions that should already exist.
 * @returns The playback service.
 */
const createMemoryPlaybackService = (
  state: MemoryPlaybackState = { media: {}, sessions: {} },
): PlaybackService & { state: MemoryPlaybackState } => ({
  state,

  explain: (mediaId, profile, requestedQuality) => {
    const item = state.media[mediaId];

    if (item === undefined) {
      return Promise.resolve(null);
    }

    const qualityClamp = resolveQualityStep(item, requestedQuality ?? 'original');
    const plan = negotiatePlayback(item, profile, qualityClamp);

    return Promise.resolve({ mode: describePlaybackMode(plan), plan });
  },

  start: (mediaId, profile, _startSeconds, audioStreamIndex, requestedQuality) => {
    const item = state.media[mediaId];

    if (item === undefined) {
      return Promise.resolve({ kind: 'notFound' as const });
    }

    if (state.unsupported === true) {
      return Promise.resolve({
        kind: 'unsupported' as const,
        reason: 'This server has no working encoder for h264.',
      });
    }

    const qualityClamp = resolveQualityStep(item, requestedQuality ?? 'original');
    const plan = negotiatePlayback(item, profile, qualityClamp);
    const sessionId =
      audioStreamIndex === undefined
        ? `session-${mediaId}`
        : `session-${mediaId}-audio-${audioStreamIndex.toString()}`;

    state.sessions[sessionId] = { 'index.m3u8': '#EXTM3U\n#EXT-X-VERSION:7\n' };

    return Promise.resolve({
      kind: 'started' as const,
      session: {
        sessionId,
        delivery: {
          kind: 'hls' as const,
          manifestUrl: `/api/playback/session/${sessionId}/index.m3u8`,
        },
        mode: describePlaybackMode(plan),
        plan,
        warnings: [],
      },
    });
  },

  readSessionFile: (sessionId, name) => {
    const contents = state.sessions[sessionId]?.[name];

    if (contents === undefined) {
      return Promise.resolve(null);
    }

    const bytes = new TextEncoder().encode(contents);

    return Promise.resolve({
      body: new Blob([bytes]).stream(),
      contentType: name.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'application/octet-stream',
      contentRange: null,
      contentLength: bytes.byteLength.toString(),
    });
  },

  trickplay: (mediaId) =>
    Promise.resolve(
      state.media[mediaId] === undefined
        ? null
        : {
            id: 'thumbs',
            url: '/api/playback/trickplay/thumbs/thumbnails.vtt',
            intervalSeconds: 10,
            tileWidth: 320,
            tileHeight: 180,
          },
    ),

  readFrame: (mediaId) =>
    Promise.resolve(
      state.media[mediaId] === undefined ? null : new TextEncoder().encode('jpeg').buffer,
    ),

  readPreview: (mediaId, range) =>
    Promise.resolve(
      state.media[mediaId] === undefined
        ? { kind: 'absent' }
        : {
            kind: 'ready',
            file: {
              body: streamOf('clip'),
              contentType: 'video/mp4',
              status: range === null ? 200 : 206,
              contentRange: range === null ? null : 'bytes 0-3/4',
              contentLength: '4',
            },
          },
    ),

  readTrickplayFile: (_, name) =>
    Promise.resolve(
      name.endsWith('.vtt')
        ? { body: new TextEncoder().encode('WEBVTT\n\n').buffer, contentType: 'text/vtt' }
        : null,
    ),

  readDirectFile: (mediaId, range) =>
    Promise.resolve(
      state.media[mediaId] === undefined
        ? null
        : {
            body: streamOf('film'),
            contentType: 'video/mp4',
            status: range === null ? 200 : 206,
            contentRange: range === null ? null : 'bytes 0-3/4',
            contentLength: '4',
          },
    ),

  stop: (sessionId) => {
    if (state.sessions[sessionId] === undefined) {
      return Promise.resolve(false);
    }

    delete state.sessions[sessionId];

    return Promise.resolve(true);
  },

  heartbeat: (sessionId) => Promise.resolve(state.sessions[sessionId] !== undefined),
});

export { createMemoryPlaybackService };
