import { mapWithLimit } from '@ValenceCore/functions/mapWithLimit';
import { previewRequestFor } from './previewRequestFor';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import type { PreviewQuality } from '@ValenceContracts/schemas/PreviewQuality';
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
  quality: PreviewQuality;
  hardwareAccel?: string;
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
 *   the preset to render at, and where to report progress.
 * @returns How many clips were rendered.
 */
const regeneratePreviews = async ({
  libraryId,
  generation,
  owner,
  store,
  transcoder,
  defaultAudioLanguage,
  quality,
  hardwareAccel,
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
        ...previewRequestFor(item, generation, defaultAudioLanguage, quality),
        ...(hardwareAccel === undefined || hardwareAccel === '' ? {} : { hardwareAccel }),
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
