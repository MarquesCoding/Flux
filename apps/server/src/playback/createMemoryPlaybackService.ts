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
 * Playback held in memory.
 *
 * Runs the real negotiator over the supplied items, so the routes are tested
 * against genuine plans rather than canned ones. Only the media service is
 * stood in for.
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
    // The chosen track is part of what a session is, so it belongs in the
    // identity of one: two tracks are two sessions.
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

    return Promise.resolve({
      body: new TextEncoder().encode(contents).buffer,
      contentType: name.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'application/octet-stream',
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

  readPreview: () => Promise.resolve(null),

  readTrickplayFile: (_, name) =>
    Promise.resolve(
      name.endsWith('.vtt')
        ? { body: new TextEncoder().encode('WEBVTT\n\n').buffer, contentType: 'text/vtt' }
        : null,
    ),

  readDirectFile: (mediaId) =>
    Promise.resolve(
      state.media[mediaId] === undefined
        ? null
        : {
            body: new TextEncoder().encode('film').buffer,
            contentType: 'video/mp4',
            status: 200,
            contentRange: null,
          },
    ),

  stop: (sessionId) => {
    if (state.sessions[sessionId] === undefined) {
      return Promise.resolve(false);
    }

    delete state.sessions[sessionId];

    return Promise.resolve(true);
  },
});

export type { MemoryPlaybackState };

export { createMemoryPlaybackService };
