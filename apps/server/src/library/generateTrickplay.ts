import { mapWithLimit } from '@FluxCore/functions/mapWithLimit';
import { wait } from '@FluxCore/functions/wait';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';

const ASK_AGAIN_MILLISECONDS = 5_000;

const GIVE_UP_MILLISECONDS = 30 * 60 * 1_000;

type TrickplayStore = {
  listOutstanding: (libraryId: string) => Promise<{ id: string; path: string }[]>;
  markComplete: (mediaItemId: string) => Promise<void>;
};

type TrickplayParams = {
  intervalSeconds: number;
  tileWidth: number;
  columns: number;
  rows: number;
};

type GenerateTrickplayOptions = {
  libraryId: string;
  generation: number;
  store: TrickplayStore;
  transcoder: Transcoder;
  trickplay: TrickplayParams;
  atOnce?: number;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (processed: number, total: number) => void;
  isCancelled?: () => boolean;
};

type RenderSheetsOptions = {
  transcoder: Transcoder;
  request: Parameters<Transcoder['requestTrickplay']>[0];
  isCancelled: (() => boolean) | undefined;
};

/**
 * Renders one item's sheets, asking the media service to begin and then asking again until it says
 * they are ready.
 *
 * Nothing waits on the render itself. A request to the media service is given up on after a minute,
 * and a feature film takes longer than that to draw: a 4K remux measured sixty-three seconds, so it
 * failed every time by three. Asking it to render in the background and saying so each time it is
 * asked costs one quick answer every few seconds and has no length of film it cannot survive.
 *
 * @param options - The media service, what to render, and whether the scan has been stopped.
 * @returns Whether the sheets were rendered, which is false where the scan was stopped.
 */
const renderSheets = async ({
  transcoder,
  request,
  isCancelled,
}: RenderSheetsOptions): Promise<boolean> => {
  const giveUpAt = Date.now() + GIVE_UP_MILLISECONDS;

  let index = await transcoder.requestTrickplay(request);

  while (!index.isReady) {
    if (isCancelled?.() === true) {
      return false;
    }

    if (Date.now() >= giveUpAt) {
      throw new Error(
        `Its thumbnails were still being drawn after ${(GIVE_UP_MILLISECONDS / 60_000).toString()} minutes.`,
      );
    }

    await wait(ASK_AGAIN_MILLISECONDS);

    index = await transcoder.requestTrickplay(request);
  }

  return true;
};

/**
 * Renders the sheets of thumbnails shown while scrubbing, for the items of a library that have none.
 * Records each item as done as it goes, so a restart resumes rather than beginning again.
 *
 * @param options - The library to work through, the transcoder that renders, and where to report
 *   progress.
 * @returns How many items were rendered.
 */
const generateTrickplay = async ({
  libraryId,
  generation,
  store,
  transcoder,
  trickplay,
  atOnce = 1,
  onProblem,
  onProgress,
  isCancelled,
}: GenerateTrickplayOptions): Promise<void> => {
  const items = await store.listOutstanding(libraryId);
  let processed = 0;

  onProgress?.(processed, items.length);

  await mapWithLimit(items, atOnce, async (item) => {
    if (isCancelled?.() === true) {
      return;
    }

    const rendered = await renderSheets({
      transcoder,
      request: { inputPath: item.path, generation, ...trickplay, wait: false },
      isCancelled,
    }).catch((error: Error) => {
      onProblem?.(item.path, error.message);

      return false;
    });

    if (rendered) {
      await store.markComplete(item.id);
    }

    processed += 1;
    onProgress?.(processed, items.length);
  });
};

export type { TrickplayParams, TrickplayStore };

export { generateTrickplay };
