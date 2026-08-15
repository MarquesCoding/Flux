import { negotiatePlayback } from '@FluxCore/functions/negotiatePlayback';
import { resolveQualityStep } from '@FluxCore/functions/resolveQualityStep';
import { describePlaybackMode } from '@FluxContracts/functions/describePlaybackMode';
import { planToSessionSpec } from '@FluxCore/functions/planToSessionSpec';
import { previewRequestFor } from '@FluxServer/library/previewRequestFor';
import {
  SEGMENT_SECONDS,
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
} from './PlaybackService';
import type { PlaybackService } from './PlaybackService';
import type { Transcoder, TranscoderCapabilities } from '@FluxServer/transcoder/TranscoderClient';

const TRICKPLAY_INDEX_NAME = 'thumbnails.vtt';

const PREVIEW_NAME = 'preview.mp4';

const IMAGE_SUBTITLE_FORMATS = new Set(['pgs', 'vobsub', 'dvbsub']);

/**
 * Whether a plan asks for nothing to be changed.
 */
/**
 * The audio stream a raw file serve would carry, with no say from Flux.
 */
const naturalAudioStreamIndex = (item: Parameters<typeof negotiatePlayback>[0]): number | null =>
  (item.audioStreams.find((stream) => stream.isDefault) ?? item.audioStreams[0])?.index ?? null;

const isDirectPlay = (
  plan: Parameters<typeof describePlaybackMode>[0],
  item: Parameters<typeof negotiatePlayback>[0],
): boolean =>
  plan.container.kind === 'passthrough' &&
  plan.video.kind === 'passthrough' &&
  plan.audio.kind === 'passthrough' &&
  plan.audio.streamIndex === naturalAudioStreamIndex(item) &&
  plan.subtitles.kind !== 'burnIn';

type MediaLookup = {
  findForPlayback: (mediaId: string) => Promise<{
    item: Parameters<typeof negotiatePlayback>[0];
    path: string;
    defaultAudioLanguage: string | null;
    generation: number;
  } | null>;
};

type CreatePlaybackServiceOptions = {
  media: MediaLookup;
  transcoder: Transcoder;
  sessionUrlPrefix: string;
  directUrlPrefix: string;
  trickplayUrlPrefix: string;
  forcedAccel?: () => Promise<string>;
};

/**
 * Playback backed by the media service.
 */
const createPlaybackService = ({
  media,
  transcoder,
  sessionUrlPrefix,
  directUrlPrefix,
  trickplayUrlPrefix,
  forcedAccel = () => Promise.resolve(''),
}: CreatePlaybackServiceOptions): PlaybackService => {
  let cached: TranscoderCapabilities | null = null;

  const capabilities = async (): Promise<TranscoderCapabilities> => {
    if (cached !== null) {
      return cached;
    }

    const found = await transcoder.capabilities();

    if (found.encoders.length > 0) {
      cached = found;
    }

    return found;
  };

  return {
    explain: async (mediaId, profile, requestedQuality) => {
      const found = await media.findForPlayback(mediaId);

      if (found === null) {
        return null;
      }

      const qualityClamp = resolveQualityStep(found.item, requestedQuality ?? 'original');
      const plan = negotiatePlayback(found.item, profile, qualityClamp, found.defaultAudioLanguage);

      return { mode: describePlaybackMode(plan), plan };
    },

    start: async (mediaId, profile, startSeconds, audioStreamIndex, requestedQuality, deviceId) => {
      const found = await media.findForPlayback(mediaId);

      if (found === null) {
        return { kind: 'notFound' };
      }

      const qualityClamp = resolveQualityStep(found.item, requestedQuality ?? 'original');
      const plan = negotiatePlayback(found.item, profile, qualityClamp, found.defaultAudioLanguage);

      if (isDirectPlay(plan, found.item) && audioStreamIndex === undefined) {
        return {
          kind: 'started',
          session: {
            sessionId: `direct-${mediaId}`,
            delivery: { kind: 'direct', url: `${directUrlPrefix}/${mediaId}/file` },
            mode: describePlaybackMode(plan),
            plan,
            warnings: [],
          },
        };
      }

      const outcome = planToSessionSpec({
        plan,
        inputPath: found.path,
        sourceRange: found.item.videoRange,
        sourceSize: [found.item.width, found.item.height],
        imageSubtitleIndexes: found.item.subtitleStreams
          .filter((stream) => IMAGE_SUBTITLE_FORMATS.has(stream.format))
          .map((stream) => stream.index),
        subtitleIndexes: found.item.subtitleStreams.map((stream) => stream.index),
        capabilities: await capabilities(),
        forcedAccel: await forcedAccel(),
        startSeconds,
        segmentSeconds: SEGMENT_SECONDS,
        ...(audioStreamIndex !== undefined
          ? { audioStreamIndex }
          : plan.audio.streamIndex === null
            ? {}
            : { audioStreamIndex: plan.audio.streamIndex }),
      });

      if (outcome.kind === 'unsupported') {
        return { kind: 'unsupported', reason: outcome.reason };
      }

      try {
        const session = await transcoder.startSession(outcome.spec, deviceId);

        return {
          kind: 'started',
          session: {
            sessionId: session.id,
            delivery: {
              kind: 'hls',
              manifestUrl: `${sessionUrlPrefix}/${session.id}/index.m3u8`,
            },
            mode: describePlaybackMode(plan),
            plan,
            warnings: outcome.warnings,
          },
        };
      } catch (error) {
        return {
          kind: 'failed',
          reason: error instanceof Error ? error.message : 'The media service failed.',
        };
      }
    },

    readSessionFile: async (sessionId, name) => transcoder.readSessionFile(sessionId, name),

    readDirectFile: async (mediaId, range) => {
      const found = await media.findForPlayback(mediaId);

      return found === null ? null : transcoder.readFile(found.path, range);
    },

    trickplay: async (mediaId) => {
      const found = await media.findForPlayback(mediaId);

      if (found === null) {
        return null;
      }

      const index = await transcoder.requestTrickplay({
        inputPath: found.path,
        generation: found.generation,
        intervalSeconds: TRICKPLAY_INTERVAL_SECONDS,
        tileWidth: TRICKPLAY_TILE_WIDTH,
        columns: TRICKPLAY_COLUMNS,
        rows: TRICKPLAY_ROWS,
        wait: false,
      });

      if (!index.isReady) {
        return null;
      }

      return {
        id: index.id,
        url: `${trickplayUrlPrefix}/${index.id}/${TRICKPLAY_INDEX_NAME}`,
        intervalSeconds: index.intervalSeconds,
        tileWidth: index.tileWidth,
        tileHeight: index.tileHeight,
      };
    },

    readFrame: async (mediaId, seconds, width) => {
      const found = await media.findForPlayback(mediaId);

      if (found === null) {
        return null;
      }

      return transcoder
        .readFrame({ inputPath: found.path, atSeconds: seconds, width })
        .catch(() => null);
    },

    readPreview: async (mediaId, range) => {
      const found = await media.findForPlayback(mediaId);

      if (found === null) {
        return { kind: 'absent' };
      }

      const clip = await transcoder
        .requestPreview({
          ...previewRequestFor(
            { path: found.path, audioStreams: found.item.audioStreams },
            found.generation,
            found.defaultAudioLanguage,
          ),
          wait: false,
        })
        .catch(() => null);

      if (clip === null) {
        return { kind: 'absent' };
      }

      if (!clip.isReady) {
        return { kind: 'pending' };
      }

      const file = await transcoder.readPreviewFile(clip.id, PREVIEW_NAME, range);

      return file === null ? { kind: 'pending' } : { kind: 'ready', file };
    },

    readTrickplayFile: (trickplayId, name) => transcoder.readTrickplayFile(trickplayId, name),

    stop: (sessionId) => transcoder.stopSession(sessionId),

    heartbeat: (sessionId, isPlaying) => transcoder.heartbeatSession(sessionId, isPlaying),
  };
};

export type { MediaLookup };

export { createPlaybackService };
