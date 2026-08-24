import type { DeviceProfile } from '@ValenceContracts/schemas/DeviceProfile';
import type { negotiatePlayback } from '@ValenceCore/functions/negotiatePlayback';

type MediaForDownload = {
  findForPlayback: (mediaId: string) => Promise<{
    item: Parameters<typeof negotiatePlayback>[0];
    path: string;
    sizeBytes: number;
    generation: number;
  } | null>;
  titleOf: (mediaId: string) => Promise<string | null>;
  episodesOf: (seriesId: string) => Promise<{ id: string; title: string }[]>;
  seriesOf: (mediaId: string) => Promise<{ id: string; title: string } | null>;
  keepingProfile: () => DeviceProfile;
};

export type { MediaForDownload };
