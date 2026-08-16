import { previewRequestFor } from '@FluxServer/library/previewRequestFor';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';
import type {
  PreviewSweepSubject,
  SweepReport,
  TrickplayRequest,
} from '@FluxServer/transcoder/TranscoderClient';

type LiveItem = {
  path: string;
  audioStreams: AudioStream[];
  generation: number;
  defaultAudioLanguage: string | null;
};

type TrickplayGeometry = {
  intervalSeconds: number;
  tileWidth: number;
  columns: number;
  rows: number;
};

type SweepArtefactCacheOptions = {
  listLiveItems: () => Promise<LiveItem[]>;
  trickplay: TrickplayGeometry;
  transcoder: {
    sweepPreviews: (keep: PreviewSweepSubject[]) => Promise<SweepReport>;
    sweepTrickplay: (keep: TrickplayRequest[]) => Promise<SweepReport>;
  };
  onProblem?: (what: string, reason: string) => void;
};

const nothing: SweepReport = { removed: 0, freedBytes: 0, kept: 0, tooNew: 0 };

const add = (left: SweepReport, right: SweepReport): SweepReport => ({
  removed: left.removed + right.removed,
  freedBytes: left.freedBytes + right.freedBytes,
  kept: left.kept + right.kept,
  tooNew: left.tooNew + right.tooNew,
});

/**
 * Deletes preview clips and scrubbing thumbnails that no item in any library addresses any more.
 * These are rendered on demand and cost real time to make, so they are kept until the thing they
 * were made for has gone.
 *
 * @param options - The transcoder holding the artefacts, and the libraries saying what is still
 *   addressed.
 * @returns What was removed, counted and measured.
 */
const sweepArtefactCache = async ({
  listLiveItems,
  trickplay,
  transcoder,
  onProblem,
}: SweepArtefactCacheOptions): Promise<SweepReport> => {
  const items = await listLiveItems();

  const previews = await transcoder
    .sweepPreviews(
      items.map((item) => previewRequestFor(item, item.generation, item.defaultAudioLanguage)),
    )
    .catch((error: Error) => {
      onProblem?.('previews', error.message);

      return nothing;
    });

  const sheets = await transcoder
    .sweepTrickplay(
      items.map((item) => ({
        inputPath: item.path,
        generation: item.generation,
        ...trickplay,
      })),
    )
    .catch((error: Error) => {
      onProblem?.('trickplay', error.message);

      return nothing;
    });

  return add(previews, sheets);
};

export type { LiveItem, TrickplayGeometry };

export { sweepArtefactCache };
