import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchArea } from './SearchArea';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

type Page = { items: MediaSummary[]; total: number };
type Options = { search?: string; kind?: string; genre?: string; limit?: number };

const fetchLibraries = vi.fn<() => Promise<{ id: string }[]>>();
const fetchLibraryItems = vi.fn<(libraryId: string, options?: Options) => Promise<Page>>();

const fetchGenres = vi.fn<() => Promise<string[]>>();

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  fetchLibraries: () => fetchLibraries(),
  fetchLibraryItems: (libraryId: string, options?: Options) =>
    fetchLibraryItems(libraryId, options),
}));

vi.mock('@FluxWeb/library/fetchGenres', () => ({
  fetchGenres: () => fetchGenres(),
}));

const item = (id: string, title: string, genres?: string[]): MediaSummary => ({
  id,
  libraryId: 'library-1',
  title,
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
  ...(genres === undefined ? {} : { genres }),
});

beforeEach(() => {
  fetchLibraries.mockReset().mockResolvedValue([{ id: 'library-1' }]);
  fetchLibraryItems
    .mockReset()
    .mockResolvedValue({ items: [item('a', 'Arrival', ['Science fiction'])], total: 1 });
  fetchGenres.mockReset().mockResolvedValue(['Science fiction']);
});

describe('SearchArea', () => {
  it('offers somewhere to type', async () => {
    render(
      <SearchArea
        search=""
        onSearchChange={vi.fn()}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );

    expect(await screen.findByRole('searchbox')).toBeInTheDocument();
  });

  it('asks the server rather than sifting what happened to arrive', async () => {
    render(
      <SearchArea
        search="arrival"
        onSearchChange={vi.fn()}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'library-1',
        expect.objectContaining({ search: 'arrival' }),
      );
    });
  });

  it('narrows to one kind of thing on request', async () => {
    const user = userEvent.setup();

    render(
      <SearchArea
        search=""
        onSearchChange={vi.fn()}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Films' }));

    await waitFor(() => {
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'library-1',
        expect.objectContaining({ kind: 'films' }),
      );
    });
  });

  it('offers the genres the library actually has', async () => {
    render(
      <SearchArea
        search=""
        onSearchChange={vi.fn()}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Science fiction' })).toBeInTheDocument();
  });

  it('shows what it found', async () => {
    render(
      <SearchArea
        search=""
        onSearchChange={vi.fn()}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: /Arrival/ })).toBeInTheDocument();
  });

  it('says how to get back when nothing matches everything asked', async () => {
    const user = userEvent.setup();

    render(
      <SearchArea
        search=""
        onSearchChange={vi.fn()}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Films' }));
    fetchLibraryItems.mockResolvedValue({ items: [], total: 0 });

    expect(await screen.findByText(/Taking one of the filters off/)).toBeInTheDocument();
  });

  it('clears what was asked on request', async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchArea
        search="arrival"
        onSearchChange={onSearchChange}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: /Clear/ }));

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('draws a programme once rather than once per episode', async () => {
    fetchLibraryItems.mockResolvedValue({
      items: [
        { ...item('e1', 'Pilot'), seriesId: 'ted', seriesTitle: 'Ted Lasso', episodeNumber: 1 },
        { ...item('e2', 'Biscuits'), seriesId: 'ted', seriesTitle: 'Ted Lasso', episodeNumber: 2 },
      ],
      total: 2,
    });

    render(
      <SearchArea
        search=""
        onSearchChange={vi.fn()}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );

    expect(await screen.findByText('1 result')).toBeInTheDocument();
  });

  it('replaces the whole result set on a filter change, not only the cards that differ', async () => {
    const user = userEvent.setup();

    render(
      <SearchArea
        search=""
        onSearchChange={vi.fn()}
        genre={null}
        onGenreChange={vi.fn()}
        onPlay={vi.fn()}
        onInspect={vi.fn()}
      />,
    );

    const before = await screen.findByRole('button', { name: /Arrival/ });

    await user.click(screen.getByRole('button', { name: 'Films' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Arrival/ })).not.toBe(before);
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(SearchArea.displayName).toBe('SearchArea');
  });
});
