import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { libraryQueries } from './libraryQueries';

const fetchLibraries = vi.hoisted(() => vi.fn());
const fetchLibraryItems = vi.hoisted(() => vi.fn());
const fetchMediaDetail = vi.hoisted(() => vi.fn());
const fetchShows = vi.hoisted(() => vi.fn());
const fetchShow = vi.hoisted(() => vi.fn());
const fetchFacets = vi.hoisted(() => vi.fn());
const fetchPerson = vi.hoisted(() => vi.fn());
const fetchPersonCredits = vi.hoisted(() => vi.fn());

vi.mock('@FluxClient/library/fetchLibrary', () => ({
  fetchLibraries,
  fetchLibraryItems,
  fetchMediaDetail,
}));

vi.mock('@FluxClient/library/fetchShows', () => ({ fetchShows, fetchShow }));
vi.mock('@FluxClient/library/fetchFacets', () => ({ fetchFacets }));
vi.mock('@FluxClient/library/fetchPerson', () => ({ fetchPerson, fetchPersonCredits }));

const aCache = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  vi.clearAllMocks();

  fetchLibraries.mockResolvedValue([{ id: 'films' }]);
  fetchLibraryItems.mockResolvedValue({ items: [{ id: 'arrival' }], total: 1 });
  fetchMediaDetail.mockResolvedValue({ id: 'arrival' });
  fetchShows.mockResolvedValue([{ id: 'ted' }]);
  fetchShow.mockResolvedValue({ id: 'ted' });
  fetchFacets.mockResolvedValue({ genres: [] });
  fetchPerson.mockResolvedValue({ id: 7 });
  fetchPersonCredits.mockResolvedValue({ cast: [] });
});

describe('libraryQueries', () => {
  it('asks for the libraries this server holds', async () => {
    await expect(aCache().fetchQuery(libraryQueries.all())).resolves.toEqual([{ id: 'films' }]);
  });

  it('keys a page by the library and by what was asked of it', () => {
    expect(libraryQueries.items('films', { search: 'dune' }).queryKey).toEqual([
      'library',
      'items',
      'films',
      { search: 'dune' },
    ]);
  });

  it('says which library a page came from, so a page can name what it is empty of', async () => {
    const page = await aCache().fetchQuery(libraryQueries.items('films', { limit: 2 }));

    expect(page).toMatchObject({ libraryId: 'films', items: [{ id: 'arrival' }] });
    expect(fetchLibraryItems).toHaveBeenCalledWith('films', { limit: 2 });
  });

  it('asks nothing where no library has been chosen', () => {
    expect(libraryQueries.items(null).enabled).toBe(false);
    expect(libraryQueries.detail(null).enabled).toBe(false);
    expect(libraryQueries.shows(null).enabled).toBe(false);
    expect(libraryQueries.show('films', null).enabled).toBe(false);
    expect(libraryQueries.person(null).enabled).toBe(false);
    expect(libraryQueries.credits(null).enabled).toBe(false);
    expect(libraryQueries.across([]).enabled).toBe(false);
  });

  it('reads one item, one programme and one library of programmes', async () => {
    const cache = aCache();

    await expect(cache.fetchQuery(libraryQueries.detail('arrival'))).resolves.toEqual({
      id: 'arrival',
    });

    await expect(cache.fetchQuery(libraryQueries.shows('films'))).resolves.toEqual([{ id: 'ted' }]);
    await expect(cache.fetchQuery(libraryQueries.show('films', 'ted'))).resolves.toEqual({
      id: 'ted',
    });
  });

  it('reads what a library can be narrowed by', async () => {
    await expect(aCache().fetchQuery(libraryQueries.facets())).resolves.toEqual({ genres: [] });
  });

  it('reads somebody and what of theirs is here', async () => {
    const cache = aCache();

    await expect(cache.fetchQuery(libraryQueries.person(7))).resolves.toEqual({ id: 7 });
    await expect(cache.fetchQuery(libraryQueries.credits(7))).resolves.toEqual({ cast: [] });
  });

  it('asks every library the same question at once', async () => {
    const found = await aCache().fetchQuery(
      libraryQueries.across(['films', 'shows'], { limit: 3 }),
    );

    expect(found).toEqual([{ id: 'arrival' }, { id: 'arrival' }]);
    expect(fetchLibraryItems).toHaveBeenCalledWith('films', { limit: 3 });
    expect(fetchLibraryItems).toHaveBeenCalledWith('shows', { limit: 3 });
  });

  it('answers with nothing for a library that failed, rather than failing the page', async () => {
    fetchLibraryItems.mockImplementation((libraryId: string) =>
      libraryId === 'films'
        ? Promise.reject(new Error('gone'))
        : Promise.resolve({ items: [{ id: 'arrival' }], total: 1 }),
    );

    await expect(aCache().fetchQuery(libraryQueries.across(['films', 'shows']))).resolves.toEqual([
      { id: 'arrival' },
    ]);
  });

  it('holds one answer however the libraries were ordered when asked', () => {
    expect(libraryQueries.across(['b', 'a'], { limit: 1 }).queryKey).toEqual(
      libraryQueries.across(['a', 'b'], { limit: 1 }).queryKey,
    );
  });
});
