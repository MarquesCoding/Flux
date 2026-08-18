import { z } from 'zod';
import { deliveredBitrateKbps } from '@FluxClient/playback/deliveredBitrateKbps';
import type shaka from 'shaka-player/dist/shaka-player.compiled';

type ShakaVariant = {
  active: boolean;
  videoCodec?: string | null;
  audioCodec?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  frameRate?: number | null;
  bandwidth?: number | null;
  audioSamplingRate?: number | null;
  channelsCount?: number | null;
};

type ShakaStats = {
  bytesDownloaded?: number;
  playTime?: number;
  streamBandwidth?: number;
};

type ShakaPlayer = {
  attach: (element: HTMLMediaElement) => Promise<void>;
  configure?: (config: { manifest: { hls: { sequenceMode: boolean } } }) => void;
  load: (manifestUrl: string, startSeconds?: number) => Promise<void>;
  destroy: () => Promise<void>;
  addEventListener?: (name: string, listener: (event: Event) => void) => void;
  getVariantTracks?: () => ShakaVariant[];
  getStats?: () => ShakaStats;
};

type ShakaModule = {
  polyfill: { installAll: () => void };
  Player: new () => ShakaPlayer;
};

const PlaybackFaultSchema = z.object({
  detail: z.object({
    severity: z.number().int(),
    category: z.number().int(),
    code: z.number().int(),
  }),
});

type PlaybackFault = z.infer<typeof PlaybackFaultSchema>['detail'];

type AttachOptions = {
  element: HTMLVideoElement;
  manifestUrl: string;
  startSeconds?: number;
  onFault?: (fault: PlaybackFault) => void;
  loadShaka?: () => Promise<ShakaModule>;
};

const CRITICAL = 2;

const SEQUENCE_MODE = { manifest: { hls: { sequenceMode: true } } } as const;

type DeliveredFormat = {
  videoCodec: string | null;
  audioCodec: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  bitrateKbps: number | null;
  audioSampleRate: number | null;
  audioChannels: number | null;
};

type AttachedStream = {
  detach: () => Promise<void>;
  readDelivered: () => DeliveredFormat | null;
};

/**
 * Reads what the engine is actually being sent, rather than what was asked for.
 *
 * The two are not the same thing and the difference is worth seeing: a plan describes an intention,
 * and the variant the engine selected describes the bytes arriving. Where a transcode does
 * something other than what was negotiated — a range it could not convert, a codec it substituted —
 * this is where it shows.
 *
 * @param variants - The variants the engine knows about.
 * @returns The active one, or nothing where the engine has not selected one yet.
 */
const mediaFetched = (element: HTMLVideoElement): number => {
  try {
    const ranges = element.buffered;

    return ranges.length === 0 ? 0 : ranges.end(ranges.length - 1);
  } catch {
    return 0;
  }
};

const deliveredFormat = (
  variants: readonly ShakaVariant[],
  stats: ShakaStats | null,
  measuredKbps: number | null = null,
): DeliveredFormat | null => {
  const active = variants.find((variant) => variant.active);

  if (active === undefined) {
    return null;
  }

  return {
    videoCodec: active.videoCodec ?? null,
    audioCodec: active.audioCodec ?? null,
    mimeType: active.mimeType ?? null,
    width: active.width ?? null,
    height: active.height ?? null,
    frameRate: active.frameRate ?? null,
    bitrateKbps:
      deliveredBitrateKbps({
        declaredBandwidth: active.bandwidth ?? stats?.streamBandwidth,
        bytesFetched: null,
        mediaSecondsFetched: null,
      }) ?? measuredKbps,
    audioSampleRate: active.audioSamplingRate ?? null,
    audioChannels: active.channelsCount ?? null,
  };
};

/**
 * Loads Shaka Player the first time something needs it. Not part of the main bundle: it is a large
 * dependency, and a session that turns out to be direct play never needs it at all.
 */
const loadShakaPlayer = async (): Promise<ShakaModule> => {
  const imported: typeof shaka = (await import('shaka-player/dist/shaka-player.compiled')).default;

  return imported;
};

/**
 * Reads an error out of an event the media engine raised, checking rather than trusting it —
 * everything about the event comes from the engine, and an event carrying no error is not a fault
 * worth reporting.
 *
 * @param event - The event the engine raised.
 * @returns The fault, or null where the event carried none.
 */
const faultFrom = (event: Event): PlaybackFault | null => {
  const found = PlaybackFaultSchema.safeParse(event);

  return found.success ? found.data.detail : null;
};

/**
 * Attaches the media engine to a video element and loads a stream into it, starting at a given
 * position where one was asked for. The position goes into the load rather than being set on the
 * element afterwards: the engine decides where playback begins as it finishes loading, and will
 * overwrite anything set before then — which looks exactly like a resume that worked for an instant
 * and then went back to the beginning.
 *
 * @param options - The element to attach to, the manifest to load, where to start, and how to report
 *   a fault the engine could not recover from.
 * @returns A handle carrying the teardown to call — an orphaned engine keeps buffering and holds
 *   the element open — and a reading of what the engine is actually being sent.
 *
 * Shaka is told to take its timestamps from the order segments arrive in rather than from inside
 * them. Its own default is the opposite, and on a copied stream it drops frames: measured against a
 * 4K HEVC remux, the picture skipped 17.292s to 17.458s, again at 35.833s and again at 46.958s — a
 * reorder window of frames lost at a segment join each time, while the sound played through and
 * nothing was counted as dropped. The same segments through hls.js lost none of them, which is what
 * showed the fault was here rather than in what Flux had produced.
 *
 * It is not a trade against seeking, which was the reason to doubt it. Seeks landed closer and
 * settled quicker than the default — within a frame at worst against 42ms, and 35ms against 108ms —
 * and resuming part way into a film landed nearer as well.
 */
const attachShaka = async ({
  element,
  manifestUrl,
  startSeconds = 0,
  onFault,
  loadShaka = loadShakaPlayer,
}: AttachOptions): Promise<AttachedStream> => {
  const shaka = await loadShaka();

  shaka.polyfill.installAll();

  const player = new shaka.Player();

  player.configure?.(SEQUENCE_MODE);

  player.addEventListener?.('error', (event) => {
    const fault = faultFrom(event);

    if (fault !== null) {
      onFault?.(fault);
    }
  });

  await player.attach(element);

  if (startSeconds > 0) {
    await player.load(manifestUrl, startSeconds);
  } else {
    await player.load(manifestUrl);
  }

  let lastSample: { bytes: number; mediaSeconds: number } | null = null;
  let measuredKbps: number | null = null;

  return {
    detach: () => player.destroy(),
    readDelivered: () => {
      const stats = player.getStats?.() ?? null;
      const sample = { bytes: stats?.bytesDownloaded ?? 0, mediaSeconds: mediaFetched(element) };

      const bytesFetched = sample.bytes - (lastSample?.bytes ?? 0);
      const mediaSecondsFetched = sample.mediaSeconds - (lastSample?.mediaSeconds ?? 0);

      if (lastSample === null || bytesFetched < 0 || mediaSecondsFetched < 0) {
        lastSample = sample;
      } else {
        const measured = deliveredBitrateKbps({
          declaredBandwidth: null,
          bytesFetched,
          mediaSecondsFetched,
        });

        if (measured !== null) {
          measuredKbps = measured;
          lastSample = sample;
        }
      }

      return deliveredFormat(player.getVariantTracks?.() ?? [], stats, measuredKbps);
    },
  };
};

export type { AttachedStream, DeliveredFormat, ShakaModule, ShakaPlayer, ShakaStats, ShakaVariant };

export { attachShaka, deliveredFormat, faultFrom, CRITICAL };
