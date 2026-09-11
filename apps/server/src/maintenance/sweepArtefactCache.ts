import { previewRequestFor } from '@ValenceServer/library/previewRequestFor';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import type { PreviewQuality } from '@ValenceContracts/schemas/PreviewQuality';
import type {
  PreviewSweepSubject,
  SweepReport,
  TrickplayRequest,
} from '@ValenceServer/transcoder/TranscoderClient';

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
  quality: PreviewQuality;
  transcoder: {
    sweepPreviews: (keep: PreviewSweepSubject[]) => Promise<SweepReport>;
    sweepTrickplay: (keep: TrickplayRequest[]) => Promise<SweepReport>;
  };
  onProblem?: (what: string, reason: string) => void;
};

const nothing: SweepReport = { removed: 0, freedBytes: 0, kept: 0, tooNew: 0 };

/**
 * Adds two sweep reports together, so that sweeping several directories reports as one figure.
 *
 * @param left - One report.
 * @param right - The other.
 * @returns The two summed.
 */
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
 * @param options - The transcoder holding the artefacts, the libraries saying what is still
 *   addressed, and the preset previews are made at now — a clip made at another is not addressed.
 * @returns What was removed, counted and measured.
 */
const sweepArtefactCache = async ({
  listLiveItems,
  trickplay,
  quality,
  transcoder,
  onProblem,
}: SweepArtefactCacheOptions): Promise<SweepReport> => {
  const items = await listLiveItems();

  const previews = await transcoder
    .sweepPreviews(
      items.map((item) =>
        previewRequestFor(item, item.generation, item.defaultAudioLanguage, quality),
      ),
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
