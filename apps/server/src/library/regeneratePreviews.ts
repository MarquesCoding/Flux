import { mapWithLimit } from '@FluxCore/functions/mapWithLimit';
import { previewRequestFor } from './previewRequestFor';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';

/**
 * The library table, as regeneration sees it.
 */
type PreviewStore = {
  /**
   * The items still without a preview, rather than all of them.
   */
  listOutstanding: (
    libraryId: string,
  ) => Promise<{ id: string; path: string; audioStreams: AudioStream[] }[]>;
  markComplete: (mediaItemId: string) => Promise<void>;
};

type RegeneratePreviewsOptions = {
  libraryId: string;
  /**
   * How many times this library has been reset.
   *
   * Addresses the clips, so it has to match what a library page will ask with.
   * Read from the library row, alongside the forced language it sits next to.
   */
  generation: number;
  store: PreviewStore;
  transcoder: Transcoder;
  /**
   * The language previews should prefer, when the library forces one.
   */
  defaultAudioLanguage: string | null;
  /**
   * How many files to render at once. One is the safe answer and the slow one.
   */
  atOnce?: number;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (processed: number, total: number) => void;
  /**
   * Asked before each render whether somebody has stopped this job.
   *
   * What has already been rendered stays rendered. Nothing is marked for the
   * items that were skipped, so the next run finds them outstanding and picks
   * up where this one left off.
   */
  isCancelled?: () => boolean;
};

/**
 * Renders the preview clips a library is still missing.
 *
 * Only what is outstanding: an item is done with when a clip has been made
 * for it, and stays done until the file changes or the library's forced audio
 * language does. A run over a library that is already complete costs one
 * query and nothing else, which is what makes putting this on a nightly
 * schedule reasonable.
 *
 * A render that fails is deliberately not marked, so the next run picks it up
 * again rather than leaving an item without a preview forever.
 */
const regeneratePreviews = async ({
  libraryId,
  generation,
  store,
  transcoder,
  defaultAudioLanguage,
  atOnce = 1,
  onProblem,
  onProgress,
  isCancelled,
}: RegeneratePreviewsOptions): Promise<void> => {
  const items = await store.listOutstanding(libraryId);
  let processed = 0;

  onProgress?.(processed, items.length);

  await mapWithLimit(items, atOnce, async (item) => {
    if (isCancelled?.() === true) {
      return;
    }

    const rendered = await transcoder
      .requestPreview({
        ...previewRequestFor(item, generation, defaultAudioLanguage),
        wait: true,
      })
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

export type { PreviewStore };

export { regeneratePreviews };
