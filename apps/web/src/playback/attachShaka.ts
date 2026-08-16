import { z } from 'zod';
import type shaka from 'shaka-player/dist/shaka-player.compiled';

type ShakaPlayer = {
  attach: (element: HTMLMediaElement) => Promise<void>;
  load: (manifestUrl: string, startSeconds?: number) => Promise<void>;
  destroy: () => Promise<void>;
  addEventListener?: (name: string, listener: (event: Event) => void) => void;
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
 * @returns The teardown to call; an orphaned engine keeps buffering and holds the element open.
 */
const attachShaka = async ({
  element,
  manifestUrl,
  startSeconds = 0,
  onFault,
  loadShaka = loadShakaPlayer,
}: AttachOptions): Promise<() => Promise<void>> => {
  const shaka = await loadShaka();

  shaka.polyfill.installAll();

  const player = new shaka.Player();

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

  return () => player.destroy();
};

export type { ShakaModule, ShakaPlayer };

export { attachShaka, faultFrom, CRITICAL };
