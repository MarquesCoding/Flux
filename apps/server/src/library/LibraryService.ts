import type {
  Library,
  LibraryFacets,
  MediaDetail,
  MediaSummary,
} from '@ValenceContracts/schemas/Library';
import type { ShowDetail, ShowSummary } from '@ValenceContracts/schemas/Show';
import type { Person } from '@ValenceContracts/schemas/Person';

type ListItemsOptions = {
  search?: string;
  kind?: 'films' | 'shows';
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  ids?: string[];
  order?: 'title' | 'newest' | 'yourRating';
  profileId?: string;
  minYourStars?: number;
  limit: number;
  offset: number;
};

type ShowService = {
  listShows: (libraryId: string) => Promise<ShowSummary[] | null>;
  getShow: (libraryId: string, showId: string) => Promise<ShowDetail | null>;
};

type CreateLibraryInput = {
  name: string;
  kind: Library['kind'];
  path: string;
};

type UpdateLibraryInput = {
  defaultAudioLanguage: string | null;
  filesAtOnce?: number | null;
};

type Correction = {
  corrected: number;
  jobId: string | null;
};

type LibraryService = ShowService & {
  list: () => Promise<Library[]>;
  create: (input: CreateLibraryInput) => Promise<Library | null>;
  update: (libraryId: string, input: UpdateLibraryInput) => Promise<Library | null>;
  listItems: (
    libraryId: string,
    options: ListItemsOptions,
  ) => Promise<{ items: MediaSummary[]; total: number } | null>;
  listFacets: () => Promise<LibraryFacets>;
  getMedia: (id: string) => Promise<MediaDetail | null>;
  getSeries: (seriesId: string) => Promise<{ id: string; title: string } | null>;
  seriesOf: (mediaId: string) => Promise<string | null>;
  findByPerson: (personId: number) => Promise<MediaSummary[]>;
  itemsForShare: (scope: {
    kind: 'item' | 'series';
    mediaId: string | null;
    seriesId: string | null;
  }) => Promise<MediaSummary[]>;
  readPerson: (personId: number) => Promise<Person | null>;
  scan: (
    libraryId: string,
    force?: boolean,
    run?: { id: string; of: number },
  ) => Promise<{ jobId: string; state: string } | null>;
  reset: (libraryId: string) => Promise<{ jobId: string; state: string } | null>;
  correctMatch: (
    mediaId: string,
    reference: { externalId: string; externalKind: 'tv' | 'movie' },
    by: string | null,
  ) => Promise<Correction | null>;
  forgetCorrection: (mediaId: string) => Promise<Correction | null>;
  rebuildArtefacts: (mediaId: string) => Promise<{ preview: boolean; trickplay: boolean } | null>;
  regeneratePreviews: (libraryId: string) => Promise<{ jobId: string; state: string } | null>;
  remakePreviews: (libraryId: string) => Promise<{ jobId: string; state: string } | null>;
  regenerateTrickplay: (libraryId: string) => Promise<{ jobId: string; state: string } | null>;
  fetchLogos: (libraryId: string) => Promise<{ jobId: string; state: string } | null>;
  detectSegments: (libraryId: string) => Promise<{ jobId: string; state: string } | null>;
  readScanState: (jobId: string) => Promise<{
    state: string;
    phase: string | null;
    processed: number | null;
    total: number | null;
  }>;
  readArtworkUrl: (mediaId: string, kind: 'poster' | 'backdrop' | 'logo') => Promise<string | null>;
};

const DEFAULT_LIMIT = 60;

export type {
  Correction,
  CreateLibraryInput,
  LibraryService,
  ListItemsOptions,
  UpdateLibraryInput,
};

export { DEFAULT_LIMIT };
