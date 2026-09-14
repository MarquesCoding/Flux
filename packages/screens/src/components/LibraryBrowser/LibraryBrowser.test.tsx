import { screen, waitFor, within } from '@testing-library/react';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shellContext } from '@ValenceClient/shell/shellContext';
import { aShell } from '@ValenceClient/testing/aShell';
import { LibraryBrowser } from './LibraryBrowser';
import type { ReactElement } from 'react';
import type { Library, MediaSummary } from '@ValenceContracts/schemas/Library';

const RECENTLY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const fetchLibrariesMock = vi.hoisted(() => vi.fn());
const fetchItemsMock = vi.hoisted(() => vi.fn());
const fetchDetailMock = vi.hoisted(() => vi.fn(() => Promise.resolve(null)));
const fetchFacetsMock = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/books/fetchBooks', () => ({
  fetchBooks: vi.fn(() => Promise.resolve([])),
  bookCoverUrl: (bookId: string) => `/api/books/${bookId}/cover`,
}));

vi.mock('@ValenceClient/library/fetchLibrary', () => ({
  fetchLibraries: fetchLibrariesMock,
  fetchLibraryItems: fetchItemsMock,
  fetchMediaDetail: fetchDetailMock,
}));

vi.mock('@ValenceClient/library/fetchFacets', () => ({ fetchFacets: fetchFacetsMock }));

const films: Library = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 2,
  lastScannedAt: null,
  defaultAudioLanguage: null,
  filesAtOnce: null,
};

const shows: Library = {
  ...films,
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Shows',
  kind: 'shows',
};

const manga: Library = {
  ...films,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Manga',
  kind: 'books',
};

const shell = aShell();

/**
 * Stands a page inside the shell every page is drawn in, which the rows read who is watching from.
 */
const inShell = (ui: ReactElement) => (
  <shellContext.Provider value={shell}>{ui}</shellContext.Provider>
);

/**
 * Draws a page inside the shell, at an address.
 */
const draw = (ui: ReactElement) => renderInAnAddress(inShell(ui));

/**
 * The card for an item, in the row that is being asked about.
 */
const cardIn = (rail: string, title: string) =>
  within(screen.getByRole('region', { name: rail })).getByRole('button', {
    name: new RegExp(title),
  });

const arrival: MediaSummary = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: films.id,
  title: 'Arrival',
  year: 2016,
  durationSeconds: 6960,
  width: 3840,
  height: 2160,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  addedAt: RECENTLY,
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
};

/**
 * Some films with nothing else in common, enough to fill a row.
 */
const several = (prefix: string, count: number): MediaSummary[] =>
  Array.from({ length: count }, (_, at) => ({
    ...arrival,
    id: `${prefix}-${at.toString()}`,
    title: `${prefix} ${at.toString()}`,
  }));

beforeEach(() => {
  fetchLibrariesMock.mockReset();
  fetchItemsMock.mockReset();
  fetchFacetsMock.mockReset();

  fetchLibrariesMock.mockResolvedValue([films]);
  fetchItemsMock.mockResolvedValue({ items: [arrival], total: 1 });
  fetchFacetsMock.mockResolvedValue({ genres: [], decades: [], maxRating: 10 });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('LibraryBrowser', () => {
  it('shows a spinner while loading', () => {
    fetchLibrariesMock.mockReturnValue(new Promise(() => undefined));
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Reading your library' })).toBeInTheDocument();
  });

  it('opens on what was added most recently, even where there is only one thing', async () => {
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    expect(cardIn('Recently added', 'Arrival')).toBeInTheDocument();
  });

  it('does not count the library at somebody, since nobody asked', async () => {
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    expect(screen.queryByText(/\d+ items?$/)).not.toBeInTheDocument();
  });

  it('plays the item that was chosen', async () => {
    const onPlay = vi.fn();
    const actor = userEvent.setup();
    draw(<LibraryBrowser onPlay={onPlay} />);

    await screen.findByRole('region', { name: 'Recently added' });
    await actor.click(cardIn('Recently added', 'Arrival'));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: arrival.id }));
  });

  it('asks each row for a few things rather than for the whole library', async () => {
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    expect(fetchItemsMock).toHaveBeenCalledWith(
      films.id,
      expect.objectContaining({ order: 'newest', limit: 20 }),
    );
    expect(fetchItemsMock).not.toHaveBeenCalledWith(
      films.id,
      expect.objectContaining({ limit: 60 }),
    );
  });

  it('asks the server to search rather than filtering the page it holds', async () => {
    const { rerender } = draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    rerender(inShell(<LibraryBrowser search="dune" onPlay={vi.fn()} />));

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalledWith(
        films.id,
        expect.objectContaining({ search: 'dune', limit: 60 }),
      );
    });
  });

  it('does not send a request for every keystroke', async () => {
    const { rerender } = draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });
    fetchItemsMock.mockClear();

    for (const partial of ['d', 'du', 'dun', 'dune']) {
      rerender(inShell(<LibraryBrowser search={partial} onPlay={vi.fn()} />));
    }

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalled();
    });

    expect(fetchItemsMock.mock.calls.length).toBeLessThan(4);
  });

  it('says when a search matches nothing', async () => {
    const { rerender } = draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 });

    rerender(inShell(<LibraryBrowser search="zzz" onPlay={vi.fn()} />));

    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });

  it('opens the programme when the heading naming it is pressed in what a search found', async () => {
    const onOpenShow = vi.fn();
    const user = userEvent.setup();
    const first: MediaSummary = {
      ...arrival,
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Hello, World',
      seriesTitle: 'A Sign of Affection',
      seasonNumber: 1,
      episodeNumber: 1,
    };

    fetchItemsMock.mockImplementation((_libraryId: string, options: { search?: string }) =>
      Promise.resolve(
        options.search === 'sign'
          ? {
              items: [
                first,
                {
                  ...first,
                  id: '00000000-0000-4000-8000-000000000002',
                  title: 'A Step Forward',
                  episodeNumber: 2,
                },
              ],
              total: 2,
            }
          : { items: [arrival], total: 1 },
      ),
    );

    const { rerender } = draw(<LibraryBrowser onOpenShow={onOpenShow} onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    rerender(inShell(<LibraryBrowser search="sign" onOpenShow={onOpenShow} onPlay={vi.fn()} />));

    await user.click(await screen.findByRole('button', { name: 'A Sign of Affection' }));

    expect(onOpenShow).toHaveBeenCalledWith(
      expect.objectContaining({ seriesTitle: 'A Sign of Affection' }),
    );
  });

  it('draws every library holding something to watch at once, with no switch between them', async () => {
    fetchLibrariesMock.mockResolvedValue([films, shows]);
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    expect(fetchItemsMock).toHaveBeenCalledWith(
      films.id,
      expect.objectContaining({ order: 'newest' }),
    );
    expect(fetchItemsMock).toHaveBeenCalledWith(
      shows.id,
      expect.objectContaining({ order: 'newest' }),
    );
    expect(screen.queryByRole('button', { name: 'Shows' })).not.toBeInTheDocument();
  });

  it('leaves books to their own section, since nothing in one can be played', async () => {
    fetchLibrariesMock.mockResolvedValue([films, manga]);
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    expect(fetchItemsMock).not.toHaveBeenCalledWith(manga.id, expect.anything());
  });

  it('gives each genre a row of its own', async () => {
    fetchFacetsMock.mockResolvedValue({ genres: ['Drama'], decades: [], maxRating: 10 });
    fetchItemsMock.mockImplementation((_libraryId: string, options: { genre?: string }) =>
      Promise.resolve(
        options.genre === 'Drama'
          ? { items: several('Drama', 5), total: 5 }
          : { items: [arrival], total: 1 },
      ),
    );

    draw(<LibraryBrowser onPlay={vi.fn()} />);

    expect(await screen.findByRole('region', { name: 'Drama' })).toBeInTheDocument();
    expect(cardIn('Drama', 'Drama 0')).toBeInTheDocument();
  });

  it('leaves out a genre with too little in it to be worth a row', async () => {
    fetchFacetsMock.mockResolvedValue({ genres: ['Drama', 'Horror'], decades: [], maxRating: 10 });
    fetchItemsMock.mockImplementation((_libraryId: string, options: { genre?: string }) =>
      Promise.resolve(
        options.genre === 'Drama'
          ? { items: several('Drama', 5), total: 5 }
          : { items: [arrival], total: 1 },
      ),
    );

    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Drama' });

    expect(screen.queryByRole('region', { name: 'Horror' })).not.toBeInTheDocument();
  });

  it('asks for more genres as somebody scrolls towards the end of the page', async () => {
    const genres = Array.from({ length: 8 }, (_, at) => `Genre ${at.toString()}`);

    class AlwaysInView {
      constructor(private readonly told: IntersectionObserverCallback) {}

      observe(target: Element): void {
        this.told(
          [
            {
              isIntersecting: true,
              intersectionRatio: 1,
              target,
              time: 0,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
            },
          ],
          new IntersectionObserver(() => undefined),
        );
      }

      unobserve(): void {
        return undefined;
      }

      disconnect(): void {
        return undefined;
      }
    }

    vi.stubGlobal('IntersectionObserver', AlwaysInView);
    fetchFacetsMock.mockResolvedValue({ genres, decades: [], maxRating: 10 });

    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalledWith(
        films.id,
        expect.objectContaining({ genre: 'Genre 7' }),
      );
    });
  });

  it('guides the operator when there are no libraries', async () => {
    fetchLibrariesMock.mockResolvedValue([]);
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'No libraries yet' })).toBeInTheDocument();
  });

  it('offers to add one to somebody who can, rather than only describing the task', async () => {
    fetchLibrariesMock.mockResolvedValue([]);

    const add = vi.fn();

    draw(<LibraryBrowser onPlay={vi.fn()} onAddLibrary={add} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add a library' }));

    expect(add).toHaveBeenCalledTimes(1);
  });

  it('offers it to nobody who could not act on it', async () => {
    fetchLibrariesMock.mockResolvedValue([]);
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('heading', { name: 'No libraries yet' });

    expect(screen.queryByRole('button', { name: 'Add a library' })).not.toBeInTheDocument();
  });

  it('tells somebody who cannot add one who can, rather than telling them to', async () => {
    fetchLibrariesMock.mockResolvedValue([]);
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('heading', { name: 'No libraries yet' });

    expect(screen.getByText('Ask the server admin to add one.')).toBeInTheDocument();
    expect(screen.queryByText('Add one to get started.')).not.toBeInTheDocument();
  });

  it('says a server with nothing anywhere has not been scanned yet', async () => {
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 });
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    expect(await screen.findByText('Nothing has been scanned yet')).toBeInTheDocument();
  });

  it('gives an administrator the button that fixes an empty library', async () => {
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 });

    const manage = vi.fn();

    draw(<LibraryBrowser onPlay={vi.fn()} onAddLibrary={manage} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Scan it' }));

    expect(manage).toHaveBeenCalledTimes(1);
  });

  it('reports an unreachable server', async () => {
    fetchLibrariesMock.mockRejectedValue(new Error('offline'));
    draw(<LibraryBrowser onPlay={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
  });

  it('never says the page is empty before every library has answered', async () => {
    fetchLibrariesMock.mockResolvedValue([films, shows]);

    const waiting: ((page: { items: MediaSummary[]; total: number }) => void)[] = [];

    fetchItemsMock.mockImplementation((libraryId: string) =>
      libraryId === films.id
        ? Promise.resolve({ items: [], total: 0 })
        : new Promise((resolve) => {
            waiting.push(resolve);
          }),
    );

    draw(<LibraryBrowser onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(waiting.length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Nothing has been scanned yet')).not.toBeInTheDocument();

    for (const answer of waiting.splice(0)) {
      answer({ items: [arrival], total: 1 });
    }

    await waitFor(() => {
      expect(cardIn('Recently added', 'Arrival')).toBeInTheDocument();
    });
  });

  describe('the hero', () => {
    const heat: MediaSummary = { ...arrival, id: 'heat-1', title: 'Heat', libraryId: shows.id };

    it('opens with a featured item when asked for one', async () => {
      draw(<LibraryBrowser hasHero onPlay={vi.fn()} />);

      expect(await screen.findByRole('region', { name: 'Featured' })).toBeInTheDocument();
    });

    it('is not drawn where somebody came looking for something specific', async () => {
      draw(<LibraryBrowser onPlay={vi.fn()} />);

      await screen.findByRole('region', { name: 'Recently added' });

      expect(screen.queryByRole('region', { name: 'Featured' })).not.toBeInTheDocument();
    });

    it('is not drawn on a server with nothing in any library', async () => {
      fetchItemsMock.mockResolvedValue({ items: [], total: 0 });
      draw(<LibraryBrowser hasHero onPlay={vi.fn()} />);

      await screen.findByText('Nothing has been scanned yet');

      expect(screen.queryByRole('region', { name: 'Featured' })).not.toBeInTheDocument();
    });

    it('draws on every library holding something to watch', async () => {
      fetchLibrariesMock.mockResolvedValue([films, shows]);
      fetchItemsMock.mockImplementation((libraryId: string) =>
        Promise.resolve(
          libraryId === films.id ? { items: [arrival], total: 1 } : { items: [heat], total: 1 },
        ),
      );

      draw(<LibraryBrowser hasHero onPlay={vi.fn()} />);

      await screen.findByRole('region', { name: 'Featured' });

      expect(fetchItemsMock).toHaveBeenCalledWith(
        shows.id,
        expect.objectContaining({ limit: 200 }),
      );
    });

    it('says which item it is showing, so the page can be lit by it', async () => {
      const onFeatureChange = vi.fn();

      draw(<LibraryBrowser hasHero onFeatureChange={onFeatureChange} onPlay={vi.fn()} />);

      await screen.findByRole('region', { name: 'Featured' });

      expect(onFeatureChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Arrival' }));
    });

    it('opens the programme when it features one of its episodes', async () => {
      fetchItemsMock.mockResolvedValue({
        items: [{ ...arrival, id: 'ep-1', seriesId: 'ted', seriesTitle: 'Ted' }],
        total: 1,
      });

      const onShow = vi.fn();
      const onPlay = vi.fn();
      const actor = userEvent.setup();

      draw(<LibraryBrowser onPlay={onPlay} onShow={onShow} hasHero />);

      await actor.click(await screen.findByRole('button', { name: /more info/i }));

      expect(onShow).toHaveBeenCalledWith('ted');
      expect(onPlay).not.toHaveBeenCalled();
    });

    it('opens a film as itself, since it stands for nothing else', async () => {
      const onShow = vi.fn();
      const onPlay = vi.fn();
      const actor = userEvent.setup();

      draw(<LibraryBrowser onPlay={onPlay} onShow={onShow} hasHero />);

      await actor.click(await screen.findByRole('button', { name: /more info/i }));

      expect(onPlay).toHaveBeenCalled();
      expect(onShow).not.toHaveBeenCalled();
    });

    it('stays up through a search that matches nothing', async () => {
      const { rerender } = draw(<LibraryBrowser hasHero onPlay={vi.fn()} />);

      await screen.findByRole('region', { name: 'Featured' });

      fetchItemsMock.mockImplementation((_libraryId: string, options: { search?: string }) =>
        Promise.resolve(
          options.search === undefined || options.search === ''
            ? { items: [arrival], total: 1 }
            : { items: [], total: 0 },
        ),
      );

      rerender(inShell(<LibraryBrowser hasHero search="nothing matches this" onPlay={vi.fn()} />));

      expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Featured' })).toBeInTheDocument();
    });
  });

  it('says while it is still reading, so a screen held over it can wait for something to show', async () => {
    const onReading = vi.fn();

    draw(<LibraryBrowser onPlay={vi.fn()} onReading={onReading} />);

    expect(onReading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(onReading).toHaveBeenLastCalledWith(false);
    });
  });

  it('holds up nothing of its own while somebody else is holding the screen for it', () => {
    draw(<LibraryBrowser onPlay={vi.fn()} onReading={vi.fn()} />);

    expect(screen.queryByRole('status', { name: 'Reading your library' })).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(LibraryBrowser.displayName).toBe('LibraryBrowser');
  });
});
