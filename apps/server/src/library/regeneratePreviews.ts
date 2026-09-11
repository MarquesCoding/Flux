import { mapWithLimit } from '@ValenceCore/functions/mapWithLimit';
import { wait } from '@ValenceCore/functions/wait';
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

const ASK_AGAIN_MILLISECONDS = 5_000;

type CutClipOptions = {
  transcoder: Transcoder;
  request: Parameters<Transcoder['requestPreview']>[0];
  isCancelled: (() => boolean) | undefined;
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
 * Cuts one clip, asking the media service to begin and then asking again until it says it is done.
 *
 * Nothing waits on the render itself. Holding the request open for the whole encode was what made a
 * scan impossible to stop: the call had no clock and no way to be abandoned, so a cancelled job sat
 * in it until every clip in flight had finished — minutes, and sometimes far longer. Asking again
 * every few seconds costs one quick answer each time and can be given up between any two of them.
 *
 * A render that fails says so: the media service remembers what went wrong and answers the next ask
 * with it, so this ends on a fault rather than on a clock. The same shape the sheets use.
 *
 * @param options - The media service, what to cut, and whether the scan has been stopped.
 * @returns Whether the clip was cut, which is false where the scan was stopped.
 */
const cutClip = async ({ transcoder, request, isCancelled }: CutClipOptions): Promise<boolean> => {
  let clip = await transcoder.requestPreview(request);

  while (!clip.isReady) {
    if (isCancelled?.() === true) {
      return false;
    }

    await wait(ASK_AGAIN_MILLISECONDS);

    clip = await transcoder.requestPreview(request);
  }

  return true;
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

    const rendered = await cutClip({
      transcoder,
      request: {
        ...previewRequestFor(item, generation, defaultAudioLanguage, quality),
        ...(hardwareAccel === undefined || hardwareAccel === '' ? {} : { hardwareAccel }),
        wait: false,
        ...(owner === undefined ? {} : { owner }),
      },
      isCancelled,
    }).catch((error: Error) => {
      onProblem?.(item.path, error.message);

      return false;
    });

    if (rendered) {
      await store.markComplete(item.id);
    }

    if (isCancelled?.() !== true) {
      processed += 1;
      onProgress?.(processed, items.length);
    }
  });
};

export type { PreviewStore };

export { regeneratePreviews };
