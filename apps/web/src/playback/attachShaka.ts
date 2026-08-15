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
 * Loads Shaka Player on demand.
 */
const loadShakaPlayer = async (): Promise<ShakaModule> => {
  const imported: typeof shaka = (await import('shaka-player/dist/shaka-player.compiled')).default;

  return imported;
};

/**
 * Reads an engine error event, if that is what it is.
 */
const faultFrom = (event: Event): PlaybackFault | null => {
  const found = PlaybackFaultSchema.safeParse(event);

  return found.success ? found.data.detail : null;
};

/**
 * Attaches a player to a video element and loads a manifest.
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

export type { AttachOptions, PlaybackFault, ShakaModule, ShakaPlayer };

export { attachShaka, loadShakaPlayer, faultFrom, CRITICAL };
