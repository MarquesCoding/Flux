import { mapWithLimit } from '@FluxCore/functions/mapWithLimit';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';

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

/**
 * Renders the scrubbing thumbnail sheets a library is still missing.
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

    const rendered = await transcoder
      .requestTrickplay({ inputPath: item.path, generation, ...trickplay, wait: true })
      .then(() => true)
      .catch((error: Error) => {
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
