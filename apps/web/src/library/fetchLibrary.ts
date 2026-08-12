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
  /**
   * Films or programmes, told apart by whether a file belongs to a series.
   */
  kind?: 'films' | 'shows';
  genre?: string;
  /**
   * Particular items, named outright — for a page built from a list kept
   * elsewhere, such as what this viewer has favourited.
   */
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
 *
 * Surfaces the server's own message on failure — it is the side that checked
 * the path is a readable directory — rather than a generic status code.
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
 * Changes a library's settings, such as which language its audio track
 * selection should prefer.
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
 *
 * Paging is a server concern rather than a client one: a library of tens of
 * thousands of items must not be shipped whole to draw one screen of posters.
 */
const fetchLibraryItems = async (
  libraryId: string,
  { search, kind, genre, ids, order, limit = 60, offset = 0 }: ListItemsOptions = {},
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
 *
 * Kept separate from the grid, which deliberately carries only enough to draw
 * a poster. Answers with nothing rather than throwing: this detail decorates
 * playback and must not be able to stop it.
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

/**
 * Asks the server to queue a rescan.
 *
 * Answers as soon as the scan is queued, not when it finishes: a real library
 * takes minutes to walk and probe. Returns the job so a caller that wants to
 * know when the walk is actually done can poll `readScanState`.
 *
 * A forced scan probes every file again rather than only those that changed on
 * disk, which is what picks up a change in how Flux reads files.
 */
const CorrectionSchema = z.object({ corrected: z.number(), jobId: z.string().nullable() });

type Correction = z.infer<typeof CorrectionSchema>;

const ProblemSchema = z.object({ error: z.string() });

/**
 * What the server says to a correction: how many files it reached, or why not.
 */
const AnswerSchema = z.union([CorrectionSchema, ProblemSchema]);

/**
 * Corrects which catalogue entry a file is.
 *
 * `reference` is whatever somebody pasted: an address or a bare id. `kind` is
 * only needed for a bare number, since the same number names one series and one
 * unrelated film.
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
 *
 * A scan the server no longer knows about — restarted since, or the id was
 * never real — is reported as `unknown` rather than thrown on, since that is
 * itself a terminal answer: whatever was watching it should stop.
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
 * Deletes every item in a library, then queues a scan to repopulate it from
 * nothing.
 *
 * A rebuild rather than a rescan: nothing already in the database is kept or
 * reconciled against, which is the point of reaching for this instead of an
 * ordinary — even forced — scan.
 */
const resetLibrary = async (libraryId: string): Promise<ScanJob | null> => {
  const response = await fetch(`/api/libraries/${libraryId}/reset`, { method: 'POST' });

  if (!response.ok) {
    return null;
  }

  return ScanJobSchema.parse(await response.json());
};

/**
 * Asks the server to re-render preview clips against the library's current
 * forced audio language.
 *
 * Lighter than a rescan: nothing is re-probed, re-matched against a
 * catalogue, or re-sampled for colour — only the previews are redrawn.
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
};
