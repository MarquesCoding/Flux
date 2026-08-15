import { previewRequestFor } from './previewRequestFor';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';
import type {
  PreviewSweepSubject,
  TrickplayRequest,
} from '@FluxServer/transcoder/TranscoderClient';

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
 * Throws away one item's preview and sheets, so the next request makes them again.
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
