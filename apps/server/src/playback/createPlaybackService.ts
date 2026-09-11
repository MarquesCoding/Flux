import { negotiatePlayback } from '@ValenceCore/functions/negotiatePlayback';
import { resolveQualityStep } from '@ValenceCore/functions/resolveQualityStep';
import { describePlaybackMode } from '@ValenceContracts/functions/describePlaybackMode';
import { planToSessionSpec } from '@ValenceCore/functions/planToSessionSpec';
import { segmentContainerFor } from '@ValenceCore/functions/segmentContainerFor';
import { previewRequestFor } from '@ValenceServer/library/previewRequestFor';
import type { PreviewQuality } from '@ValenceContracts/schemas/PreviewQuality';
import {
  SEGMENT_SECONDS,
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
} from './PlaybackService';
import { VideoRangeSchema } from '@ValenceContracts/schemas/MediaItem';
import type { MediaItem } from '@ValenceContracts/schemas/MediaItem';
import type { PlaybackPlan } from '@ValenceContracts/schemas/PlaybackPlan';
import type { PlaybackService } from './PlaybackService';
import type {
  Transcoder,
  TranscoderCapabilities,
} from '@ValenceServer/transcoder/TranscoderClient';

const TRICKPLAY_INDEX_NAME = 'thumbnails.vtt';

const PREVIEW_NAME = 'preview.mp4';

const IMAGE_SUBTITLE_FORMATS = new Set(['pgs', 'vobsub', 'dvbsub']);

/**
 * Rewrites a plan to say what was actually done rather than what was decided, for the cases where
 * the media service does more than the negotiator asked — a session that was to pass the picture
 * through but is being encoded should report itself as encoding, or the statistics panel describes a
 * session nobody is watching.
 *
 * @param plan - What the negotiator decided.
 * @param item - The file it decided about.
 * @param encodesVideo - Whether the picture is in fact being encoded.
 * @returns The plan as carried out.
 */
/**
 * Corrects the range a plan claims to the one the output will really carry.
 *
 * A transcode that cannot tone map does not produce SDR. It re-encodes the picture and leaves its
 * colour metadata alone, so the stream stays HDR and a client that colour manages shows it
 * correctly. Announcing SDR while emitting PQ is the one answer that is wrong either way: it tells
 * a viewer their HDR was converted when it was not, and tells anything reading the plan to expect a
 * range the bytes contradict.
 *
 * @param plan - The plan as negotiated.
 * @param deliveredRange - The range the media service says the output will carry.
 * @returns The plan, saying what will really arrive.
 */
const withDeliveredRange = (plan: PlaybackPlan, deliveredRange: string): PlaybackPlan => {
  if (plan.video.kind !== 'transcode' || plan.video.range === deliveredRange) {
    return plan;
  }

  const range = VideoRangeSchema.safeParse(deliveredRange);

  return range.success ? { ...plan, video: { ...plan.video, range: range.data } } : plan;
};

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

/**
 * The audio track a player would pick on its own if nothing were negotiated: the one the file marks
 * as default, or the first. Knowing this is what makes it possible to tell a session that happens to
 * be playing the natural track from one that had to be steered onto it.
 *
 * @param item - The file, as the catalogue holds it.
 * @returns That track's index, or null where the file has no audio at all.
 */
const naturalAudioStreamIndex = (item: Parameters<typeof negotiatePlayback>[0]): number | null =>
  (item.audioStreams.find((stream) => stream.isDefault) ?? item.audioStreams[0])?.index ?? null;

/**
 * Whether a plan amounts to handing over the file untouched — nothing remuxed, nothing re-encoded,
 * the track the player would have chosen anyway, and no subtitles burned in. Anything less counts as
 * the server doing work, and is worth saying so, because direct play is the only mode that costs
 * nothing to serve.
 *
 * HEVC never qualifies, whatever the plan says. An HEVC stream in MP4 is marked either `hvc1` or
 * `hev1`, the marking decides whether a player will decode it, and Valence does not know which a given
 * file carries — the catalogue records the codec and not the tag it was written with. Sending it
 * through a session instead costs a copy, which is close to nothing, and the session marks it
 * `hvc1` on the way out. So the tag is right on every path rather than on the paths that happen to
 * re-wrap it.
 *
 * That is stricter than Jellyfin, which serves HEVC statically and retags only what it remuxes. The
 * difference is a file Valence copies where Jellyfin would not, against a black picture on any player
 * that reads the tag strictly. Worth revisiting if the catalogue ever learns the tag.
 *
 * @param plan - What the negotiator decided.
 * @param item - The file it decided about.
 * @returns Whether the file is being handed over as it is.
 */
const isDirectPlay = (
  plan: Parameters<typeof describePlaybackMode>[0],
  item: Parameters<typeof negotiatePlayback>[0],
): boolean =>
  plan.container.kind === 'passthrough' &&
  plan.video.kind === 'passthrough' &&
  plan.audio.kind === 'passthrough' &&
  plan.audio.streamIndex === naturalAudioStreamIndex(item) &&
  plan.subtitles.kind !== 'burnIn' &&
  item.videoCodec !== 'hevc';

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
  previewQuality?: () => Promise<PreviewQuality>;
};

/**
 * Playback as it actually runs: negotiating what a client can take, starting a session on the media
 * service where anything needs changing, and serving the file directly where nothing does. Also
 * where a session is stopped, kept alive and asked about.
 *
 * @param options - The library to read files from, the transcoder to run sessions on, and the
 *   settings that bound what a session may cost.
 * @returns The playback service.
 */
const createPlaybackService = ({
  media,
  transcoder,
  sessionUrlPrefix,
  directUrlPrefix,
  trickplayUrlPrefix,
  forcedAccel = () => Promise.resolve(''),
  previewQuality = (): Promise<PreviewQuality> => Promise.resolve('high'),
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
            reuse: null,
          },
        };
      }

      const outcome = planToSessionSpec({
        plan,
        inputPath: found.path,
        sourceRange: found.item.videoRange,
        sourceSize: [found.item.width, found.item.height],
        sourceVideoCodec: found.item.videoCodec,
        imageSubtitleIndexes: found.item.subtitleStreams
          .filter((stream) => IMAGE_SUBTITLE_FORMATS.has(stream.format))
          .map((stream) => stream.index),
        subtitleIndexes: found.item.subtitleStreams.map((stream) => stream.index),
        capabilities: await capabilities(),
        forcedAccel: await forcedAccel(),
        startSeconds,
        segmentSeconds: SEGMENT_SECONDS,
        container: segmentContainerFor(profile),
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

        const delivered = withDeliveredRange(
          asDelivered(plan, found.item, session.encodesVideo),
          outcome.deliveredRange,
        );

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
            reuse: session.reuse,
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
            await previewQuality(),
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

    stop: (sessionId, deviceId) => transcoder.stopSession(sessionId, deviceId),

    heartbeat: (sessionId, isPlaying) => transcoder.heartbeatSession(sessionId, isPlaying),
  };
};

export type { MediaLookup };

export { createPlaybackService };
