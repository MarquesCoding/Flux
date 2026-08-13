import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchLibraries,
  createLibrary,
  updateLibrary,
  fetchLibraryItems,
  scanLibrary,
  readScanState,
  resetLibrary,
  regenerateLibraryPreviews,
  correctMatch,
  forgetCorrection,
} from './fetchLibrary';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>;

const fetchMock = vi.fn<FetchLike>();

const library = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 2,
  lastScannedAt: null,

  defaultAudioLanguage: null,

  filesAtOnce: null,
};

const summary = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: library.id,
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 3840,
  height: 2160,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  addedAt: '2026-08-10T00:00:00.000Z',
};

const ok = (body: JsonValue) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLibraries', () => {
  it('returns the libraries', async () => {
    fetchMock.mockResolvedValue(ok([library]));

    await expect(fetchLibraries()).resolves.toMatchObject([{ name: 'Films', itemCount: 2 }]);
  });

  it('throws when the server errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });

    await expect(fetchLibraries()).rejects.toThrow(/500/);
  });

  it('throws when the response does not match the contract', async () => {
    fetchMock.mockResolvedValue(ok([{ name: 'Films' }]));

    await expect(fetchLibraries()).rejects.toThrow();
  });
});

describe('createLibrary', () => {
  const input = { name: 'Films', kind: 'movies' as const, path: '/media/films' };

  it('returns the created library', async () => {
    fetchMock.mockResolvedValue(ok(library));

    await expect(createLibrary(input)).resolves.toMatchObject({ name: 'Films' });
  });

  it('sends the request body as json', async () => {
    fetchMock.mockResolvedValue(ok(library));

    await createLibrary(input);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/libraries',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('surfaces the server error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'The path is not a readable directory.' }),
    });

    await expect(createLibrary(input)).rejects.toThrow('The path is not a readable directory.');
  });

  it('falls back to the status code when there is no error message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });

    await expect(createLibrary(input)).rejects.toThrow(/500/);
  });
});

describe('updateLibrary', () => {
  it('returns the updated library', async () => {
    fetchMock.mockResolvedValue(ok({ ...library, defaultAudioLanguage: 'de' }));

    await expect(updateLibrary(library.id, { defaultAudioLanguage: 'de' })).resolves.toMatchObject({
      defaultAudioLanguage: 'de',
      filesAtOnce: null,
    });
  });

  it('sends the request body as json to the library endpoint', async () => {
    fetchMock.mockResolvedValue(ok(library));

    await updateLibrary(library.id, { defaultAudioLanguage: 'de' });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/libraries/${library.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ defaultAudioLanguage: 'de' }),
      }),
    );
  });

  it('surfaces the server error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'No such library.' }),
    });

    await expect(updateLibrary(library.id, { defaultAudioLanguage: 'de' })).rejects.toThrow(
      'No such library.',
    );
  });
});

describe('fetchLibraryItems', () => {
  it('returns a page of items', async () => {
    fetchMock.mockResolvedValue(ok({ items: [summary], total: 1 }));

    await expect(fetchLibraryItems(library.id)).resolves.toMatchObject({
      total: 1,
      items: [{ title: 'Arrival' }],
    });
  });

  it('asks for a page rather than the whole library', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], total: 0 }));

    await fetchLibraryItems(library.id, { limit: 24, offset: 48 });

    expect(fetchMock.mock.calls[0]?.[0]).toContain('limit=24');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('offset=48');
  });

  it('sends a search term when given one', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], total: 0 }));

    await fetchLibraryItems(library.id, { search: 'dune' });

    expect(fetchMock.mock.calls[0]?.[0]).toContain('search=dune');
  });

  it('omits an empty search term', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], total: 0 }));

    await fetchLibraryItems(library.id, { search: '   ' });

    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('search=');
  });

  it('escapes a search term that would otherwise break the query', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], total: 0 }));

    await fetchLibraryItems(library.id, { search: 'a&b=c' });

    expect(fetchMock.mock.calls[0]?.[0]).toContain('search=a%26b%3Dc');
  });

  it('throws when the server errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) });

    await expect(fetchLibraryItems(library.id)).rejects.toThrow(/404/);
  });
});

describe('scanLibrary', () => {
  it('returns the queued job', async () => {
    fetchMock.mockResolvedValue(ok({ jobId: 'job-1', state: 'queued' }));

    await expect(scanLibrary(library.id)).resolves.toEqual({ jobId: 'job-1', state: 'queued' });
  });

  it('reports failure without throwing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) });

    await expect(scanLibrary(library.id)).resolves.toBeNull();
  });

  it('asks for an ordinary scan by default', async () => {
    fetchMock.mockResolvedValue(ok({ jobId: 'job-1', state: 'queued' }));

    await scanLibrary(library.id);

    expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${library.id}/scan`, { method: 'POST' });
  });

  it('asks for everything to be probed again when forced', async () => {
    fetchMock.mockResolvedValue(ok({ jobId: 'job-1', state: 'queued' }));

    await scanLibrary(library.id, true);

    expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${library.id}/scan?force=true`, {
      method: 'POST',
    });
  });
});

describe('readScanState', () => {
  it('returns the state, phase and progress of a queued scan', async () => {
    fetchMock.mockResolvedValue(
      ok({ jobId: 'job-1', state: 'running', phase: 'probing', processed: 4, total: 10 }),
    );

    await expect(readScanState('job-1')).resolves.toEqual({
      jobId: 'job-1',
      state: 'running',
      phase: 'probing',
      processed: 4,
      total: 10,
    });
  });

  it('reports unknown rather than throwing when the server errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) });

    await expect(readScanState('job-1')).resolves.toEqual({
      jobId: 'job-1',
      state: 'unknown',
      phase: null,
      processed: null,
      total: null,
    });
  });
});

describe('resetLibrary', () => {
  it('returns the queued rebuild job', async () => {
    fetchMock.mockResolvedValue(ok({ jobId: 'job-1', state: 'queued' }));

    await expect(resetLibrary(library.id)).resolves.toEqual({ jobId: 'job-1', state: 'queued' });
  });

  it('reports failure without throwing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) });

    await expect(resetLibrary(library.id)).resolves.toBeNull();
  });

  it('posts to the reset endpoint for the library', async () => {
    fetchMock.mockResolvedValue(ok({ jobId: 'job-1', state: 'queued' }));

    await resetLibrary(library.id);

    expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${library.id}/reset`, {
      method: 'POST',
    });
  });
});

describe('regenerateLibraryPreviews', () => {
  it('returns the queued regeneration job', async () => {
    fetchMock.mockResolvedValue(ok({ jobId: 'job-1', state: 'queued' }));

    await expect(regenerateLibraryPreviews(library.id)).resolves.toEqual({
      jobId: 'job-1',
      state: 'queued',
    });
  });

  it('reports failure without throwing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) });

    await expect(regenerateLibraryPreviews(library.id)).resolves.toBeNull();
  });

  it('posts to the regenerate-previews endpoint for the library', async () => {
    fetchMock.mockResolvedValue(ok({ jobId: 'job-1', state: 'queued' }));

    await regenerateLibraryPreviews(library.id);

    expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${library.id}/regenerate-previews`, {
      method: 'POST',
    });
  });
});

describe('narrowing a request for items', () => {
  it('asks for one kind when one was named', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0 }),
    });

    await fetchLibraryItems(library.id, { kind: 'shows' });

    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('kind=shows');
  });

  it('asks for one genre when one was named', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0 }),
    });

    await fetchLibraryItems(library.id, { genre: 'Science fiction' });

    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('genre=Science+fiction');
  });

  it('leaves a genre of nothing out, rather than asking for the empty one', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0 }),
    });

    await fetchLibraryItems(library.id, { genre: '' });

    expect(fetchMock.mock.calls.at(-1)?.[0]).not.toContain('genre=');
  });

  it('asks for particular items by id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0 }),
    });

    await fetchLibraryItems(library.id, { ids: ['a', 'b'] });

    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('ids=a%2Cb');
  });

  it('asks for an order when one was named', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [], total: 0 }),
    });

    await fetchLibraryItems(library.id, { order: 'newest' });

    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('order=newest');
  });
});

describe('saying what a file actually is', () => {
  const CORRECTION = { corrected: 4, jobId: 'job-1' };

  it('sends the reference and reports how many files it reached', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(CORRECTION) });

    await expect(correctMatch('media-1', '329', 'movie')).resolves.toEqual(CORRECTION);

    const [, init] = fetchMock.mock.calls.at(-1) ?? [];

    expect(init?.body).toContain('"kind":"movie"');
  });

  it('leaves the kind out when the reference says it already', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(CORRECTION) });

    await correctMatch('media-1', 'https://www.themoviedb.org/movie/329');

    const [, init] = fetchMock.mock.calls.at(-1) ?? [];

    expect(init?.body).not.toContain('kind');
  });

  it('passes on the reason the server refused', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'That does not look like a catalogue id.' }),
    });

    await expect(correctMatch('media-1', 'nonsense')).resolves.toEqual({
      problem: 'That does not look like a catalogue id.',
    });
  });

  it('says what the server answered when it did not explain itself', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });

    await expect(correctMatch('media-1', '329', 'movie')).resolves.toEqual({
      problem: 'The server answered 500.',
    });
  });

  it('says the server could not be reached rather than blaming the request', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(correctMatch('media-1', '329', 'movie')).resolves.toEqual({
      problem: 'The server could not be reached.',
    });
  });
});

describe('forgetting a correction', () => {
  it('reports what putting it back reached', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ corrected: 4, jobId: null }),
    });

    await expect(forgetCorrection('media-1')).resolves.toEqual({ corrected: 4, jobId: null });
  });

  it('has nothing to report when the server refused', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) });

    await expect(forgetCorrection('media-1')).resolves.toBeNull();
  });

  it('has nothing to report when the server could not be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(forgetCorrection('media-1')).resolves.toBeNull();
  });

  it('has nothing to report when the answer was not one it recognises', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ nope: true }),
    });

    await expect(forgetCorrection('media-1')).resolves.toBeNull();
  });
});

describe('when the server refuses to add or change a library', () => {
  it('raises the reason the server gave for refusing to add one', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'That path is not a readable directory.' }),
    });

    await expect(
      createLibrary({ name: 'Films', kind: 'movies', path: '/nowhere' }),
    ).rejects.toThrow('That path is not a readable directory.');
  });

  it('raises the status when a refusal to add one explains nothing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });

    await expect(
      createLibrary({ name: 'Films', kind: 'movies', path: '/media/films' }),
    ).rejects.toThrow('500');
  });

  it('raises the status when a refusal to change one explains nothing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });

    await expect(updateLibrary(library.id, { defaultAudioLanguage: null })).rejects.toThrow('500');
  });
});
