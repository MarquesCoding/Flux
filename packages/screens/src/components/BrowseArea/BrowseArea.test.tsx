import { screen, waitFor } from '@testing-library/react';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowseArea } from './BrowseArea';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type Page = { items: MediaSummary[]; total: number };
type Options = { kind?: string; order?: string; ids?: string[]; limit?: number };

const fetchLibraries = vi.fn<() => Promise<{ id: string }[]>>();
const fetchLibraryItems = vi.fn<(libraryId: string, options?: Options) => Promise<Page>>();

vi.mock('@ValenceClient/library/fetchLibrary', () => ({
  fetchLibraries: () => fetchLibraries(),
  fetchLibraryItems: (libraryId: string, options?: Options) =>
    fetchLibraryItems(libraryId, options),
}));

const item = (id: string, title: string): MediaSummary => ({
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
});

beforeEach(() => {
  fetchLibraries.mockReset().mockResolvedValue([{ id: 'library-1' }]);
  fetchLibraryItems.mockReset().mockResolvedValue({ items: [item('a', 'Arrival')], total: 1 });
});

describe('BrowseArea', () => {
  it('names the page it is', async () => {
    renderInAnAddress(<BrowseArea kind="shows" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Shows' })).toBeInTheDocument();
  });

  it('asks the server for what comes in episodes', async () => {
    renderInAnAddress(<BrowseArea kind="shows" onPlay={vi.fn()} onInspect={vi.fn()} />);

    await waitFor(() => {
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'library-1',
        expect.objectContaining({ kind: 'shows' }),
      );
    });
  });

  it('asks for the newest first on the page about newness', async () => {
    renderInAnAddress(<BrowseArea kind="new" onPlay={vi.fn()} onInspect={vi.fn()} />);

    await waitFor(() => {
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'library-1',
        expect.objectContaining({ order: 'newest' }),
      );
    });
  });

  it('asks for exactly what this viewer kept, by name', async () => {
    renderInAnAddress(
      <BrowseArea kind="favourites" favourites={['a', 'b']} onPlay={vi.fn()} onInspect={vi.fn()} />,
    );

    await waitFor(() => {
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'library-1',
        expect.objectContaining({ ids: ['a', 'b'] }),
      );
    });
  });

  it('asks for nothing at all where nothing has been kept', async () => {
    renderInAnAddress(
      <BrowseArea kind="favourites" favourites={[]} onPlay={vi.fn()} onInspect={vi.fn()} />,
    );

    await waitFor(() => {
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'library-1',
        expect.objectContaining({ ids: [] }),
      );
    });
  });

  it('shows what it found', async () => {
    renderInAnAddress(<BrowseArea kind="films" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /Arrival/ })).toBeInTheDocument();
  });

  it('says why it is empty and what would fill it', async () => {
    fetchLibraryItems.mockResolvedValue({ items: [], total: 0 });

    renderInAnAddress(<BrowseArea kind="favourites" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByText(/The heart on any item puts it here/)).toBeInTheDocument();
  });

  it('tells the page what it loaded, so an address can be turned back into an item', async () => {
    const onItemsLoaded = vi.fn();

    renderInAnAddress(
      <BrowseArea
        kind="films"
        onPlay={vi.fn()}
        onInspect={vi.fn()}
        onItemsLoaded={onItemsLoaded}
      />,
    );

    await waitFor(() => {
      expect(onItemsLoaded).toHaveBeenCalledWith([expect.objectContaining({ id: 'a' })]);
    });
  });

  it('says it could not be read when the server cannot be reached, rather than that it is empty', async () => {
    fetchLibraries.mockRejectedValue(new Error('offline'));

    renderInAnAddress(<BrowseArea kind="films" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
    expect(screen.queryByText(/Nothing here stands on its own yet/)).not.toBeInTheDocument();
  });

  it('offers to try again, since a server that was down may not be', async () => {
    fetchLibraries.mockRejectedValue(new Error('offline'));

    renderInAnAddress(<BrowseArea kind="films" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(BrowseArea.displayName).toBe('BrowseArea');
  });
});
