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
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';
import type { PlaybackPlan } from '@FluxContracts/schemas/PlaybackPlan';
import type { PlaybackService } from './PlaybackService';
import type { Transcoder, TranscoderCapabilities } from '@FluxServer/transcoder/TranscoderClient';

/**
 * Subtitle formats that are pictures rather than text.
 *
 * These cannot be converted, so burning them in means compositing a second
 * video stream rather than drawing text.
 */
/**
 * The file the media service names its index.
 */
const TRICKPLAY_INDEX_NAME = 'thumbnails.vtt';

/**
 * The file the media service names a preview clip.
 */
const PREVIEW_NAME = 'preview.mp4';

const IMAGE_SUBTITLE_FORMATS = new Set(['pgs', 'vobsub', 'dvbsub']);

/**
 * Whether a plan asks for nothing to be changed.
 *
 * Every axis passing through means the file can be sent as it is, which is
 * cheaper than even a remux and puts no load on the media service at all.
 */
/**
 * The audio stream a raw file serve would carry, with no say from Flux.
 *
 * A browser given the file directly plays whichever stream the container
 * itself marks default, or its first. This is that same rule, computed here
 * so a direct serve can be trusted only when it would land on the stream
 * negotiation actually chose.
 */
/**
 * The plan as it was actually carried out.
 *
 * The media service refuses to copy a source whose own keyframes cannot produce
 * segments a player will take, and encodes it instead. Only it can tell — the
 * decision needs the packet index, which the server never reads — so a plan
 * that said the video would pass through has to be corrected before anybody is
 * shown it. Reporting a direct stream while encoding is a claim about the
 * viewer's own playback that is not true, and the mode label is derived from
 * this plan rather than kept beside it.
 */
const asDelivered = (plan: PlaybackPlan, item: MediaItem, encodesVideo: boolean): PlaybackPlan => {
  if (!encodesVideo || plan.video.kind !== 'passthrough') {
    return plan;
  }

  return {
    ...plan,
    video: {
      kind: 'transcode',
      codec: 'h264',
      range: item.videoRange,
      maxBitrateKbps: item.bitrateKbps,
      maxWidth: item.width,
      maxHeight: item.height,
      reason: {
        code: 'VideoNotSegmentable',
        detail:
          'The source cannot be cut into segments a player can start at, so it is encoded instead',
      },
    },
  };
};

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
    /**
     * The language the item's library forces audio selection toward, when an
     * operator has set one.
     */
    defaultAudioLanguage: string | null;
    /**
     * How many times the item's library has been reset.
     *
     * Read here rather than passed in, so a player and a scan asking about the
     * same file always agree on which generation's artefacts they mean. Two
     * callers disagreeing would each address a set the other never made.
     */
    generation: number;
  } | null>;
};

type CreatePlaybackServiceOptions = {
  media: MediaLookup;
  transcoder: Transcoder;
  sessionUrlPrefix: string;
  directUrlPrefix: string;
  /**
   * Where seek-bar previews are served from.
   *
   * Proxied like segments are, because the media service reads any path it is
   * given and has no authentication of its own.
   */
  trickplayUrlPrefix: string;
  /**
   * The hardware backend an operator insisted on, read fresh each time.
   *
   * Not cached alongside the capabilities: changing it in the dashboard should
   * take effect on the next play rather than on the next restart.
   */
  forcedAccel?: () => Promise<string>;
};

/**
 * Playback backed by the media service.
 *
 * Capabilities are read once and cached: probing them runs a real encode per
 * candidate, which is cheap at startup and wasteful on every play.
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

        const delivered = asDelivered(plan, found.item, session.encodesVideo);

        return {
          kind: 'started',
          session: {
            sessionId: session.id,
            delivery: {
              kind: 'hls',
              manifestUrl: `${sessionUrlPrefix}/${session.id}/index.m3u8`,
            },
            mode: describePlaybackMode(delivered),
            plan: delivered,
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
