import { mapWithLimit } from '@FluxCore/functions/mapWithLimit';
import { previewRequestFor } from './previewRequestFor';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';

type PreviewStore = {
  listOutstanding: (
    libraryId: string,
  ) => Promise<{ id: string; path: string; audioStreams: AudioStream[] }[]>;
  markComplete: (mediaItemId: string) => Promise<void>;
};

type RegeneratePreviewsOptions = {
  libraryId: string;
  generation: number;
  store: PreviewStore;
  transcoder: Transcoder;
  defaultAudioLanguage: string | null;
  atOnce?: number;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (processed: number, total: number) => void;
  isCancelled?: () => boolean;
};

/**
 * Renders the preview clips a library is still missing.
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
