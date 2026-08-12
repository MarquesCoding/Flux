import { previewRequestFor } from '@FluxServer/library/previewRequestFor';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';
import type {
  PreviewSweepSubject,
  SweepReport,
  TrickplayRequest,
} from '@FluxServer/transcoder/TranscoderClient';

/**
 * One file still in a library, and everything its artefacts are addressed by.
 */
type LiveItem = {
  path: string;
  audioStreams: AudioStream[];
  /**
   * How many times the item's library has been reset.
   */
  generation: number;
  /**
   * The audio language its library forces, when it forces one.
   */
  defaultAudioLanguage: string | null;
};

/**
 * The tile geometry sheets are drawn to, which is part of their address.
 */
type TrickplayGeometry = {
  intervalSeconds: number;
  tileWidth: number;
  columns: number;
  rows: number;
};

type SweepArtefactCacheOptions = {
  /**
   * Every item in every library, with what addresses its artefacts.
   *
   * Every library at once rather than one at a time, deliberately: the cache is
   * one flat directory of hashes shared by all of them, so a sweep that knew
   * about only one library would find every other library's artefacts
   * unaddressed and delete the lot.
   */
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
 * Deletes preview clips and thumbnail sheets nothing in any library addresses.
 *
 * An artefact outlives the thing it was made for by design: a preview is
 * addressed by its content, so changing how previews are made, or resetting a
 * library, renames every one of them and leaves the old files behind. Nothing
 * deletes them at the moment they are orphaned, because deleting on the strength
 * of a wrong list is far worse than the disk it reclaims. This is the only thing
 * that ever reclaims it.
 *
 * The live set is built with `previewRequestFor`, the same function the generator
 * uses. That is the whole safety argument: a request built even slightly
 * differently addresses a different clip, and this is the caller that deletes
 * whatever it does not recognise.
 *
 * A failure sweeping one kind does not stop the other. Nothing is deleted
 * locally, so a media service that will not answer costs a run rather than
 * anything permanent.
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
