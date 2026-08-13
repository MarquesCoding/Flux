import { previewRequestFor } from './previewRequestFor';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';
import type {
  PreviewSweepSubject,
  TrickplayRequest,
} from '@FluxServer/transcoder/TranscoderClient';

/**
 * One item, and everything its artefacts are addressed by.
 */
type RebuildSubject = {
  path: string;
  audioStreams: AudioStream[];
  generation: number;
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

type RebuildItemArtefactsOptions = {
  item: RebuildSubject;
  trickplay: TrickplayGeometry;
  transcoder: {
    forgetPreview: (request: PreviewSweepSubject) => Promise<boolean>;
    forgetTrickplay: (request: TrickplayRequest) => Promise<boolean>;
  };
  onProblem?: (what: string, reason: string) => void;
};

/**
 * What was actually there to remove.
 */
type Rebuilt = {
  preview: boolean;
  trickplay: boolean;
};

/**
 * Throws away one item's preview and sheets, so the next request makes them
 * again.
 *
 * The answer to a viewer saying "that one looks wrong". Everything else Flux can
 * do is wholesale: a reset rebuilds a library, a recipe bump rebuilds every
 * artefact of a kind. Neither is a reasonable response to one bad clip, and
 * before this the only remedy was deleting a hashed directory out of a temp
 * folder by hand.
 *
 * Deleting rather than orphaning, unlike a recipe bump. The reasoning that
 * favours orphaning is about *computed* lists, where being wrong takes artefacts
 * nobody meant to touch. Here an operator has pointed at one item and asked for
 * it again, the address comes from hashing that item's own request, and the
 * worst outcome is that a clip is rendered twice.
 *
 * Built with `previewRequestFor`, the same function the generator and the sweep
 * use, so all three agree about which clip is which.
 *
 * A failure on one kind does not stop the other: half a rebuild is better than
 * none, and the half that failed can be asked for again.
 */
const rebuildItemArtefacts = async ({
  item,
  trickplay,
  transcoder,
  onProblem,
}: RebuildItemArtefactsOptions): Promise<Rebuilt> => {
  const preview = await transcoder
    .forgetPreview(previewRequestFor(item, item.generation, item.defaultAudioLanguage))
    .catch((error: Error) => {
      onProblem?.('preview', error.message);

      return false;
    });

  const sheets = await transcoder
    .forgetTrickplay({ inputPath: item.path, generation: item.generation, ...trickplay })
    .catch((error: Error) => {
      onProblem?.('trickplay', error.message);

      return false;
    });

  return { preview, trickplay: sheets };
};

export type { RebuildSubject, Rebuilt };

export { rebuildItemArtefacts };
