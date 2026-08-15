import { z } from 'zod';
import { LibrarySchema, MediaPageSchema, MediaDetailSchema } from '@FluxContracts/schemas/Library';
import type { Library, LibraryKind, MediaDetail, MediaPage } from '@FluxContracts/schemas/Library';

const LibraryListSchema = z.array(LibrarySchema);
const ErrorBodySchema = z.object({ error: z.string() });

const ScanStateSchema = z.enum(['queued', 'running', 'completed', 'failed', 'unknown']);
const ScanJobSchema = z.object({ jobId: z.string(), state: ScanStateSchema });
const ScanProgressSchema = z.object({
  jobId: z.string(),
  state: ScanStateSchema,
  phase: z.string().nullable(),
  processed: z.number().int().nonnegative().nullable(),
  total: z.number().int().nonnegative().nullable(),
});

type ScanState = z.infer<typeof ScanStateSchema>;
type ScanJob = z.infer<typeof ScanJobSchema>;
type ScanProgress = z.infer<typeof ScanProgressSchema>;

type ListItemsOptions = {
  search?: string;
  kind?: 'films' | 'shows';
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  ids?: string[];
  order?: 'title' | 'newest';
  limit?: number;
  offset?: number;
};

type CreateLibraryInput = {
  name: string;
  kind: LibraryKind;
  path: string;
};

type UpdateLibraryInput = {
  defaultAudioLanguage: string | null;
  filesAtOnce?: number | null;
};

/**
 * Reads every library on this server.
 */
const fetchLibraries = async (): Promise<Library[]> => {
  const response = await fetch('/api/libraries', { headers: { accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`Libraries request failed with status ${response.status.toString()}`);
  }

  return LibraryListSchema.parse(await response.json());
};

/**
 * Adds a library root.
 */
const createLibrary = async (input: CreateLibraryInput): Promise<Library> => {
  const response = await fetch('/api/libraries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const parsed = ErrorBodySchema.safeParse(await response.json().catch(() => null));

    throw new Error(
      parsed.success
        ? parsed.data.error
        : `Library request failed with status ${response.status.toString()}`,
    );
  }

  return LibrarySchema.parse(await response.json());
};

/**
 * Changes a library's settings, such as which language its audio track selection should prefer.
 */
const updateLibrary = async (libraryId: string, input: UpdateLibraryInput): Promise<Library> => {
  const response = await fetch(`/api/libraries/${libraryId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const parsed = ErrorBodySchema.safeParse(await response.json().catch(() => null));

    throw new Error(
      parsed.success
        ? parsed.data.error
        : `Library request failed with status ${response.status.toString()}`,
    );
  }

  return LibrarySchema.parse(await response.json());
};

/**
 * Reads a page of items from a library.
 */
const fetchLibraryItems = async (
  libraryId: string,
  {
    search,
    kind,
    genre,
    yearFrom,
    yearTo,
    minRating,
    ids,
    order,
    limit = 60,
    offset = 0,
  }: ListItemsOptions = {},
): Promise<MediaPage> => {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  if (search !== undefined && search.trim() !== '') {
    query.set('search', search.trim());
  }

  if (kind !== undefined) {
    query.set('kind', kind);
  }

  if (genre !== undefined && genre !== '') {
    query.set('genre', genre);
  }

  if (yearFrom !== undefined) {
    query.set('yearFrom', String(yearFrom));
  }

  if (yearTo !== undefined) {
    query.set('yearTo', String(yearTo));
  }

  if (minRating !== undefined) {
    query.set('minRating', String(minRating));
  }

  if (ids !== undefined) {
    query.set('ids', ids.join(','));
  }

  if (order !== undefined) {
    query.set('order', order);
  }

  const response = await fetch(`/api/libraries/${libraryId}/items?${query.toString()}`, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Items request failed with status ${response.status.toString()}`);
  }

  return MediaPageSchema.parse(await response.json());
};

/**
 * Reads everything about one item, including its streams.
 */
const fetchMediaDetail = async (mediaId: string): Promise<MediaDetail | null> => {
  try {
    const response = await fetch(`/api/media/${mediaId}`, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return MediaDetailSchema.parse(await response.json());
  } catch {
    return null;
  }
};

const CorrectionSchema = z.object({ corrected: z.number(), jobId: z.string().nullable() });

type Correction = z.infer<typeof CorrectionSchema>;

const ProblemSchema = z.object({ error: z.string() });

const AnswerSchema = z.union([CorrectionSchema, ProblemSchema]);

/**
 * Corrects which catalogue entry a file is.
 */
const correctMatch = async (
  mediaId: string,
  reference: string,
  kind?: 'tv' | 'movie',
): Promise<Correction | { problem: string }> => {
  const response = await fetch(`/api/media/${mediaId}/match`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ reference, ...(kind === undefined ? {} : { kind }) }),
  }).catch(() => null);

  if (response === null) {
    return { problem: 'The server could not be reached.' };
  }

  const answer = AnswerSchema.safeParse(await response.json().catch(() => null));

  if (response.ok && answer.success && 'corrected' in answer.data) {
    return answer.data;
  }

  return {
    problem:
      answer.success && 'error' in answer.data
        ? answer.data.error
        : `The server answered ${response.status.toString()}.`,
  };
};

/**
 * Forgets a correction, putting the file back to whatever the catalogue finds.
 */
const forgetCorrection = async (mediaId: string): Promise<Correction | null> => {
  const response = await fetch(`/api/media/${mediaId}/match`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  const body = CorrectionSchema.safeParse(await response.json().catch(() => null));

  return body.success ? body.data : null;
};

const RebuiltArtefactsSchema = z.object({ preview: z.boolean(), trickplay: z.boolean() });

type RebuiltArtefacts = z.infer<typeof RebuiltArtefactsSchema>;

/**
 * Throws away one item's preview and thumbnails, so they are made again.
 */
const rebuildArtefacts = async (mediaId: string): Promise<RebuiltArtefacts | null> => {
  const response = await fetch(`/api/media/${mediaId}/artefacts/rebuild`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  const body = RebuiltArtefactsSchema.safeParse(await response.json().catch(() => null));

  return body.success ? body.data : null;
};

const scanLibrary = async (libraryId: string, force = false): Promise<ScanJob | null> => {
  const query = force ? '?force=true' : '';
  const response = await fetch(`/api/libraries/${libraryId}/scan${query}`, { method: 'POST' });

  if (!response.ok) {
    return null;
  }

  return ScanJobSchema.parse(await response.json());
};

/**
 * Reads how a queued scan is getting on.
 */
const readScanState = async (jobId: string): Promise<ScanProgress> => {
  const response = await fetch(`/api/libraries/scans/${jobId}`, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    return { jobId, state: 'unknown', phase: null, processed: null, total: null };
  }

  return ScanProgressSchema.parse(await response.json());
};

/**
 * Deletes every item in a library, then queues a scan to repopulate it from nothing.
 */
const resetLibrary = async (libraryId: string): Promise<ScanJob | null> => {
  const response = await fetch(`/api/libraries/${libraryId}/reset`, { method: 'POST' });

  if (!response.ok) {
    return null;
  }

  return ScanJobSchema.parse(await response.json());
};

/**
 * Asks the server to re-render preview clips against the library's current forced audio language.
 */
const regenerateLibraryPreviews = async (libraryId: string): Promise<ScanJob | null> => {
  const response = await fetch(`/api/libraries/${libraryId}/regenerate-previews`, {
    method: 'POST',
  });

  if (!response.ok) {
    return null;
  }

  return ScanJobSchema.parse(await response.json());
};

export type {
  ListItemsOptions,
  CreateLibraryInput,
  Correction,
  UpdateLibraryInput,
  ScanJob,
  ScanState,
  ScanProgress,
  RebuiltArtefacts,
};

export { ScanJobSchema };

export {
  fetchLibraries,
  createLibrary,
  updateLibrary,
  fetchLibraryItems,
  fetchMediaDetail,
  scanLibrary,
  readScanState,
  resetLibrary,
  regenerateLibraryPreviews,
  correctMatch,
  forgetCorrection,
  rebuildArtefacts,
};
