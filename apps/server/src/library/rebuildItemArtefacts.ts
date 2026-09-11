import { previewRequestFor } from './previewRequestFor';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import type { PreviewQuality } from '@ValenceContracts/schemas/PreviewQuality';
import type {
  PreviewSweepSubject,
  TrickplayRequest,
} from '@ValenceServer/transcoder/TranscoderClient';

type RebuildSubject = {
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

type RebuildItemArtefactsOptions = {
  item: RebuildSubject;
  trickplay: TrickplayGeometry;
  quality: PreviewQuality;
  transcoder: {
    forgetPreview: (request: PreviewSweepSubject) => Promise<boolean>;
    forgetTrickplay: (request: TrickplayRequest) => Promise<boolean>;
  };
  onProblem?: (what: string, reason: string) => void;
};

type Rebuilt = {
  preview: boolean;
  trickplay: boolean;
};

/**
 * Throws away one item's preview clip and thumbnail sheets so the next request renders them again.
 * The answer to "that one looks wrong": a reset rebuilds a whole library and a recipe change
 * rebuilds every artefact of a kind, and neither is a reasonable response to one bad clip.
 *
 * @param options - Which item, the preset its preview was made at, the transcoder holding its
 *   artefacts, and the store recording what has been made.
 * @returns Whether there was a preview and sheets to throw away.
 */
const rebuildItemArtefacts = async ({
  item,
  trickplay,
  quality,
  transcoder,
  onProblem,
}: RebuildItemArtefactsOptions): Promise<Rebuilt> => {
  const preview = await transcoder
    .forgetPreview(previewRequestFor(item, item.generation, item.defaultAudioLanguage, quality))
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

export type { RebuildSubject };

export { rebuildItemArtefacts };
