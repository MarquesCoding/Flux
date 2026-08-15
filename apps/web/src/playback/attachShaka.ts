import { z } from 'zod';
import type shaka from 'shaka-player/dist/shaka-player.compiled';

/**
 * The slice of Shaka that Flux uses.
 *
 * Narrowed from the shipped types so tests can supply a stand-in without
 * reproducing a media engine, and so it is obvious what Flux depends on.
 */
type ShakaPlayer = {
  attach: (element: HTMLMediaElement) => Promise<void>;
  load: (manifestUrl: string) => Promise<void>;
  destroy: () => Promise<void>;
  addEventListener?: (name: string, listener: (event: Event) => void) => void;
};

type ShakaModule = {
  polyfill: { installAll: () => void };
  Player: new () => ShakaPlayer;
};

/**
 * What the engine reports when something goes wrong after loading.
 *
 * Severity distinguishes the two cases that matter: an error the engine
 * recovers from on its own, and one that has ended playback. Parsed rather
 * than trusted, because it arrives on a DOM event the engine builds.
 */
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
  onFault?: (fault: PlaybackFault) => void;
  loadShaka?: () => Promise<ShakaModule>;
};

/**
 * The engine's own value for an error it could not recover from.
 */
const CRITICAL = 2;

/**
 * Loads Shaka Player on demand.
 *
 * Imported dynamically so the engine is not in the initial bundle: most of a
 * session is spent browsing, and a viewer who never presses play should never
 * download a media engine.
 */
const loadShakaPlayer = async (): Promise<ShakaModule> => {
  const imported: typeof shaka = (await import('shaka-player/dist/shaka-player.compiled')).default;

  return imported;
};

/**
 * Reads an engine error event, if that is what it is.
 *
 * Everything about the event comes from the engine rather than from Flux, so
 * it is checked rather than trusted: an event carrying no error at all is not
 * a fault worth reporting.
 */
const faultFrom = (event: Event): PlaybackFault | null => {
  const found = PlaybackFaultSchema.safeParse(event);

  return found.success ? found.data.detail : null;
};

/**
 * Attaches a player to a video element and loads a manifest.
 *
 * Returns a teardown function. Callers must call it: an orphaned player keeps
 * buffering and holds the media element open.
 *
 * Errors after loading are reported through `onFault`. The engine raises them
 * as events rather than by rejecting, so without this a stream that stopped
 * mid-film left the viewer looking at a frozen picture and Flux with nothing
 * to say about it.
 */
const attachShaka = async ({
  element,
  manifestUrl,
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
  await player.load(manifestUrl);

  return () => player.destroy();
};

export type { AttachOptions, PlaybackFault, ShakaModule, ShakaPlayer };

export { attachShaka, loadShakaPlayer, faultFrom, CRITICAL };
