import { mapWithLimit } from '@FluxCore/functions/mapWithLimit';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';

/**
 * The library table, as trickplay regeneration sees it.
 */
type TrickplayStore = {
  /**
   * The items still without a thumbnail sheet, rather than all of them.
   */
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
  store: TrickplayStore;
  transcoder: Transcoder;
  trickplay: TrickplayParams;
  /**
   * How many sheets to draw at once. One is the safe answer and the slow one.
   */
  atOnce?: number;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (processed: number, total: number) => void;
  /**
   * Asked before each sheet whether somebody has stopped this job.
   *
   * Nothing is marked for the items that were skipped, so the next run finds
   * them outstanding and carries on from there.
   */
  isCancelled?: () => boolean;
};

/**
 * Renders the scrubbing thumbnail sheets a library is still missing.
 *
 * Only what is outstanding, the same way `regeneratePreviews` is: a sheet
 * that exists is not drawn again, so a nightly run over a complete library
 * costs one query. A render that fails is not marked, so the next run tries
 * it again.
 */
const generateTrickplay = async ({
  libraryId,
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
      .requestTrickplay({ inputPath: item.path, ...trickplay, wait: true })
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
