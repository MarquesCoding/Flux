import { readFromServerOrAbsent } from '@FluxClient/query/readFromServerOrAbsent';
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
  order?: 'title' | 'newest' | 'yourRating';
  minYourStars?: number;
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
 * Reads every library on this server, with where each reads from and when it was last scanned.
 */
const fetchLibraries = async (): Promise<Library[]> => {
  const response = await fetch('/api/libraries', {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Libraries request failed with status ${response.status.toString()}`);
  }

  return LibraryListSchema.parse(await response.json());
};

/**
 * Adds a library root, surfacing the server's own message on failure — it is the side that checked
 * the path is a readable directory, and a generic status code would leave an operator guessing.
 *
 * @param input - What to call it, what kind it is, and where it lives.
 * @returns The library as created.
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
 * Changes a library's settings — the audio language to prefer, how many files to render at once.
 *
 * @param libraryId - The library to change.
 * @param input - The settings to apply.
 * @returns The library as it now stands.
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
 * Reads one page of a library, with whatever narrowing was asked for. Paging is the server's concern
 * rather than this one's: a library of tens of thousands must not be shipped whole to draw one
 * screen of posters.
 *
 * @param libraryId - The library to read.
 * @param options - What to search for, what to narrow by, and which page to read.
 * @returns The page, and how many items match in total.
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
    minYourStars,
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

  if (minYourStars !== undefined) {
    query.set('minYourStars', String(minYourStars));
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
 * Reads everything about one item, including its streams — kept apart from the grid, which carries
 * only enough to draw a poster. Answers with nothing rather than throwing: this detail decorates
 * playback and must not be able to stop it.
 *
 * @param mediaId - The item to read.
 * @returns Everything held about it, or null where it could not be read.
 */
const fetchMediaDetail = async (mediaId: string): Promise<MediaDetail | null> => {
  return readFromServerOrAbsent(`/api/media/${mediaId}`, MediaDetailSchema);
};

const CorrectionSchema = z.object({ corrected: z.number(), jobId: z.string().nullable() });

type Correction = z.infer<typeof CorrectionSchema>;

const ProblemSchema = z.object({ error: z.string() });

const AnswerSchema = z.union([CorrectionSchema, ProblemSchema]);

/**
 * Corrects which catalogue entry a file is, from whatever an operator pasted — an address or a bare
 * identifier. The correction reaches every file of the same programme rather than the one episode.
 *
 * @param mediaId - The item being corrected.
 * @param reference - What was pasted.
 * @param kind - Whether it is a film or a programme, needed only for a bare number.
 * @returns How many files it reached, or why it was refused.
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
 * Forgets a correction, putting a file back to whatever the catalogue finds on its own.
 *
 * @param mediaId - The item to un-correct.
 * @returns How many files it reached, or null where the server refused.
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
 * Throws away one item's preview clip and thumbnails so they are rendered again — the answer to
 * "that one looks wrong". Both false is not a failure: it means the item had nothing cached, which
 * is the state that was wanted.
 *
 * @param mediaId - The item to rebuild.
 * @returns What there was to throw away, or null where the server refused.
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

/**
 * Asks for a library to be scanned, answering with the job so the page can follow it. Scans by
 * default only what has changed since last time; forcing re-probes every file, which is what to do
 * when the catalogue is wrong rather than merely out of date.
 *
 * @param libraryId - The library to scan.
 * @param force - Whether to re-probe every file.
 * @returns The job to follow, or null where the request failed.
 */
const scanLibrary = async (libraryId: string, force = false): Promise<ScanJob | null> => {
  const query = force ? '?force=true' : '';
  const response = await fetch(`/api/libraries/${libraryId}/scan${query}`, {
    method: 'POST',
  });

  if (!response.ok) {
    return null;
  }

  return ScanJobSchema.parse(await response.json());
};

/**
 * Reads how a queued scan is getting on. A scan the server no longer knows about — restarted since,
 * or an identifier that was never real — is reported as unknown rather than thrown on, since that is
 * itself a terminal answer: whatever was watching should stop.
 *
 * @param jobId - The scan to ask about.
 * @returns Its state, and how far it has got where it has said.
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
 * Deletes every item in a library and queues a scan to fill it again from nothing. A rebuild rather
 * than a rescan: nothing already stored is kept or reconciled against, which is the point of
 * reaching for this instead of a forced scan.
 *
 * @param libraryId - The library to rebuild.
 * @returns The scan to watch, or null where the server refused.
 */
const resetLibrary = async (libraryId: string): Promise<ScanJob | null> => {
  const response = await fetch(`/api/libraries/${libraryId}/reset`, { method: 'POST' });

  if (!response.ok) {
    return null;
  }

  return ScanJobSchema.parse(await response.json());
};

/**
 * Asks for the preview clips to be rendered again against the library's current audio language.
 * Lighter than a rescan: nothing is re-probed, re-matched or re-sampled, only the clips redrawn.
 *
 * @param libraryId - The library to redraw.
 * @returns The job to watch, or null where the server refused.
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
