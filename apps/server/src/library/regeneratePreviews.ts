import { mapWithLimit } from '@ValenceCore/functions/mapWithLimit';
import { previewRequestFor } from './previewRequestFor';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import type { Transcoder } from '@ValenceServer/transcoder/TranscoderClient';

type PreviewStore = {
  listOutstanding: (
    libraryId: string,
  ) => Promise<{ id: string; path: string; audioStreams: AudioStream[] }[]>;
  markComplete: (mediaItemId: string) => Promise<void>;
};

type RegeneratePreviewsOptions = {
  libraryId: string;
  generation: number;
  owner?: string;
  store: PreviewStore;
  transcoder: Transcoder;
  defaultAudioLanguage: string | null;
  atOnce?: number;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (processed: number, total: number) => void;
  isCancelled?: () => boolean;
};

/**
 * Renders the short clips shown when a pointer rests on a card, for the items of a library that have
 * none. Also what runs after the library's preferred audio language changes, since a preview is cut
 * with sound.
 *
 * @param options - The library to work through, the transcoder that renders, the language to prefer,
 *   and where to report progress.
 * @returns How many clips were rendered.
 */
const regeneratePreviews = async ({
  libraryId,
  generation,
  owner,
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
        ...(owner === undefined ? {} : { owner }),
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
