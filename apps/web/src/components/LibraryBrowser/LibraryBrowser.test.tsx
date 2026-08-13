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

  it('reports how many items there are', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />);

    expect(await screen.findByText('1 item')).toBeInTheDocument();
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

  it('says when an empty library needs scanning', async () => {
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 });
    render(<LibraryBrowser onPlay={vi.fn()} />);

    expect(await screen.findByText(/Scan it to find your media/)).toBeInTheDocument();
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

    await screen.findByText(/This library is empty/);

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
});
