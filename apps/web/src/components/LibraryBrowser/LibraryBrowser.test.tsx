import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryBrowser } from './LibraryBrowser';
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library';

const fetchLibrariesMock = vi.hoisted(() => vi.fn());
const fetchItemsMock = vi.hoisted(() => vi.fn());
const fetchDetailMock = vi.hoisted(() => vi.fn(() => Promise.resolve(null)));

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  fetchLibraries: fetchLibrariesMock,
  fetchLibraryItems: fetchItemsMock,
  fetchMediaDetail: fetchDetailMock,
}));

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

const shows: Library = { ...films, id: '11111111-1111-4111-8111-111111111111', name: 'Shows' };

/**
 * The card for an item, in the row that is being asked about.
 *
 * An item legitimately appears in more than one row — something that arrived
 * yesterday is both recent and a film — so a bare query by title finds several
 * and says nothing about either.
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
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
};

beforeEach(() => {
  fetchLibrariesMock.mockReset();
  fetchItemsMock.mockReset();

  fetchLibrariesMock.mockResolvedValue([films]);
  fetchItemsMock.mockResolvedValue({ items: [arrival], total: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LibraryBrowser', () => {
  it('shows a spinner while loading', () => {
    fetchLibrariesMock.mockReturnValue(new Promise(() => undefined));
    render(<LibraryBrowser onPlay={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Reading your library' })).toBeInTheDocument();
  });

  it('lists the items in the first library', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    expect(cardIn('Recently added', 'Arrival')).toBeInTheDocument();
  });

  it('does not count the library at somebody, since nobody asked', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    expect(screen.queryByText(/\d+ items?$/)).not.toBeInTheDocument();
  });

  it('plays the item that was chosen', async () => {
    const onPlay = vi.fn();
    const actor = userEvent.setup();
    render(<LibraryBrowser onPlay={onPlay} />);

    await screen.findByRole('region', { name: 'Recently added' });
    await actor.click(cardIn('Recently added', 'Arrival'));

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: arrival.id }));
  });

  it('asks the server to search rather than filtering the page it holds', async () => {
    const { rerender } = render(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    rerender(<LibraryBrowser search="dune" onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalledWith(
        films.id,
        expect.objectContaining({ search: 'dune' }),
      );
    });
  });

  it('does not send a request for every keystroke', async () => {
    const { rerender } = render(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });
    fetchItemsMock.mockClear();

    for (const partial of ['d', 'du', 'dun', 'dune']) {
      rerender(<LibraryBrowser search={partial} onPlay={vi.fn()} />);
    }

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalled();
    });

    expect(fetchItemsMock.mock.calls.length).toBeLessThan(4);
  });

  it('says when a search matches nothing', async () => {
    const { rerender } = render(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 });

    rerender(<LibraryBrowser search="zzz" onPlay={vi.fn()} />);

    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });

  it('switches between libraries', async () => {
    fetchLibrariesMock.mockResolvedValue([films, shows]);
    const actor = userEvent.setup();
    render(<LibraryBrowser onPlay={vi.fn()} />);

    await actor.click(await screen.findByRole('button', { name: 'Shows' }));

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalledWith(shows.id, expect.anything());
    });
  });

  it('opens the programme when the hero features one of its episodes', async () => {
    const episode: MediaSummary = {
      ...arrival,
      id: 'ep-1',
      seriesId: 'ted',
      seriesTitle: 'Ted',
    };

    fetchItemsMock.mockResolvedValue({ items: [episode], total: 1 });

    const onShow = vi.fn();
    const onPlay = vi.fn();
    const actor = userEvent.setup();

    render(<LibraryBrowser onPlay={onPlay} onShow={onShow} hasHero />);

    await actor.click(await screen.findByRole('button', { name: /more info/i }));

    expect(onShow).toHaveBeenCalledWith('ted');
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('opens a film as itself, since it stands for nothing else', async () => {
    const onShow = vi.fn();
    const onPlay = vi.fn();
    const actor = userEvent.setup();

    render(<LibraryBrowser onPlay={onPlay} onShow={onShow} hasHero />);

    await actor.click(await screen.findByRole('button', { name: /more info/i }));

    expect(onPlay).toHaveBeenCalled();
    expect(onShow).not.toHaveBeenCalled();
  });

  it('asks the server for a page rather than the whole library', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />);

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalledWith(films.id, expect.objectContaining({ limit: 60 }));
    });
  });

  it('guides the operator when there are no libraries', async () => {
    fetchLibrariesMock.mockResolvedValue([]);
    render(<LibraryBrowser onPlay={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'No libraries yet' })).toBeInTheDocument();
  });

  it('says a server with nothing anywhere has not been scanned yet', async () => {
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 });
    render(<LibraryBrowser onPlay={vi.fn()} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    screen.debug(document.body, 4000);

    expect(await screen.findByText('Nothing has been scanned yet')).toBeInTheDocument();
  });

  it('reports an unreachable server', async () => {
    fetchLibrariesMock.mockRejectedValue(new Error('offline'));
    render(<LibraryBrowser onPlay={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  });

  it('opens with a featured item when asked for a hero', async () => {
    render(<LibraryBrowser hasHero onPlay={vi.fn()} />);

    expect(await screen.findByRole('region', { name: 'Featured' })).toBeInTheDocument();
  });

  it('shows no hero where someone came looking for something specific', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Recently added' });

    expect(screen.queryByRole('region', { name: 'Featured' })).not.toBeInTheDocument();
  });

  it('shows no hero over an empty library', async () => {
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 });
    render(<LibraryBrowser hasHero onPlay={vi.fn()} />);

    await screen.findByText('Nothing has been scanned yet');

    expect(screen.queryByRole('region', { name: 'Featured' })).not.toBeInTheDocument();
  });

  it('opens the programme when the heading naming it is pressed', async () => {
    const onOpenShow = vi.fn();
    const user = userEvent.setup();
    const first = {
      ...arrival,
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Hello, World',
      seriesTitle: 'A Sign of Affection',
      seasonNumber: 1,
      episodeNumber: 1,
    };
    fetchItemsMock.mockResolvedValue({
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
    });
    render(<LibraryBrowser onOpenShow={onOpenShow} onPlay={vi.fn()} />);

    const heading = await screen.findByRole('button', {
      name: 'A Sign of Affection',
    });

    await user.click(heading);

    expect(onOpenShow).toHaveBeenCalledWith(
      expect.objectContaining({ seriesTitle: 'A Sign of Affection' }),
    );
  });

  it('says which item the hero is showing, so the page can be lit by it', async () => {
    const onFeatureChange = vi.fn();
    render(<LibraryBrowser hasHero onFeatureChange={onFeatureChange} onPlay={vi.fn()} />);

    await screen.findByRole('region', { name: 'Featured' });

    expect(onFeatureChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Arrival' }));
  });

  describe('the hero', () => {
    const heat: MediaSummary = { ...arrival, id: 'heat-1', title: 'Heat', libraryId: shows.id };

    /**
     * Two libraries, each holding one thing, with only one of them selected.
     */
    const twoLibraries = () => {
      fetchLibrariesMock.mockResolvedValue([films, shows]);
      fetchItemsMock.mockImplementation((libraryId: string) =>
        Promise.resolve(
          libraryId === films.id ? { items: [arrival], total: 1 } : { items: [heat], total: 1 },
        ),
      );
    };

    it('draws on every library, not only the one being browsed', async () => {
      const onFeatureChange = vi.fn();

      twoLibraries();
      render(<LibraryBrowser hasHero onFeatureChange={onFeatureChange} onPlay={vi.fn()} />);

      await screen.findByRole('region', { name: 'Featured' });

      await waitFor(() => {
        expect(fetchItemsMock).toHaveBeenCalledWith(shows.id, expect.anything());
      });
    });

    it('stays put when a different library is chosen', async () => {
      const actor = userEvent.setup();
      const onFeatureChange = vi.fn();

      twoLibraries();
      render(<LibraryBrowser hasHero onFeatureChange={onFeatureChange} onPlay={vi.fn()} />);

      await screen.findByRole('region', { name: 'Featured' });

      onFeatureChange.mockClear();

      await actor.click(screen.getByRole('button', { name: 'Shows' }));

      await waitFor(() => {
        expect(cardIn('Recently added', 'Heat')).toBeInTheDocument();
      });

      expect(onFeatureChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Nothing' }),
      );
      expect(screen.getByRole('region', { name: 'Featured' })).toBeInTheDocument();
    });

    it('survives a search that matches nothing in the library being browsed', async () => {
      const actor = userEvent.setup();

      twoLibraries();

      const { rerender } = render(<LibraryBrowser hasHero onPlay={vi.fn()} />);

      await screen.findByRole('region', { name: 'Featured' });

      fetchItemsMock.mockImplementation((_libraryId: string, options: { search: string }) =>
        Promise.resolve(
          options.search === '' ? { items: [arrival], total: 1 } : { items: [], total: 0 },
        ),
      );

      rerender(<LibraryBrowser hasHero search="nothing matches this" onPlay={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
      });

      expect(screen.getByRole('region', { name: 'Featured' })).toBeInTheDocument();
      expect(actor).toBeDefined();
    });

    it('is not drawn on a server with nothing in any library', async () => {
      fetchItemsMock.mockResolvedValue({ items: [], total: 0 });
      render(<LibraryBrowser hasHero onPlay={vi.fn()} />);

      await screen.findByText('Nothing has been scanned yet');

      expect(screen.queryByRole('region', { name: 'Featured' })).not.toBeInTheDocument();
    });
  });

  it('never says a library is empty before its items have arrived', async () => {
    const actor = userEvent.setup();

    fetchLibrariesMock.mockResolvedValue([films, shows]);

    /**
     * Films is empty and Shows is not, and Shows answers slowly.
     *
     * That is the shape of the bug: the selection changed at once, the items
     * followed later, and the empty state in between described the library it
     * had not read yet — announcing that a full library was empty, right up
     * until its contents appeared.
     */
    let answerShows = (page: { items: MediaSummary[]; total: number }) => {
      expect(page).toBeDefined();
    };

    fetchItemsMock.mockImplementation((libraryId: string, options: { limit: number }) => {
      const isHeroSample = options.limit !== 60;

      if (isHeroSample) {
        return Promise.resolve(
          libraryId === films.id ? { items: [], total: 0 } : { items: [arrival], total: 1 },
        );
      }

      return libraryId === films.id
        ? Promise.resolve({ items: [], total: 0 })
        : new Promise((resolve) => {
            answerShows = resolve;
          });
    });

    render(<LibraryBrowser onPlay={vi.fn()} />);

    await screen.findByText('Nothing in Films yet');

    await actor.click(screen.getByRole('button', { name: 'Shows' }));

    expect(screen.queryByText('Nothing in Shows yet')).not.toBeInTheDocument();

    answerShows({ items: [arrival], total: 1 });

    await waitFor(() => {
      expect(cardIn('Recently added', 'Arrival')).toBeInTheDocument();
    });
  });
});
