import { screen, waitFor } from '@testing-library/react';
import { renderInACache } from '@FluxWeb/testing/renderInACache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowseArea } from './BrowseArea';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

type Page = { items: MediaSummary[]; total: number };
type Options = { kind?: string; order?: string; ids?: string[]; limit?: number };

const fetchLibraries = vi.fn<() => Promise<{ id: string }[]>>();
const fetchLibraryItems = vi.fn<(libraryId: string, options?: Options) => Promise<Page>>();

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
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
    renderInACache(<BrowseArea kind="shows" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Shows' })).toBeInTheDocument();
  });

  it('asks the server for what comes in episodes', async () => {
    renderInACache(<BrowseArea kind="shows" onPlay={vi.fn()} onInspect={vi.fn()} />);

    await waitFor(() => {
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'library-1',
        expect.objectContaining({ kind: 'shows' }),
      );
    });
  });

  it('asks for the newest first on the page about newness', async () => {
    renderInACache(<BrowseArea kind="new" onPlay={vi.fn()} onInspect={vi.fn()} />);

    await waitFor(() => {
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'library-1',
        expect.objectContaining({ order: 'newest' }),
      );
    });
  });

  it('asks for exactly what this viewer kept, by name', async () => {
    renderInACache(
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
    renderInACache(
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
    renderInACache(<BrowseArea kind="films" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /Arrival/ })).toBeInTheDocument();
  });

  it('says why it is empty and what would fill it', async () => {
    fetchLibraryItems.mockResolvedValue({ items: [], total: 0 });

    renderInACache(<BrowseArea kind="favourites" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByText(/The heart on any item puts it here/)).toBeInTheDocument();
  });

  it('tells the page what it loaded, so an address can be turned back into an item', async () => {
    const onItemsLoaded = vi.fn();

    renderInACache(
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

  it('carries on when the server cannot be reached', async () => {
    fetchLibraries.mockRejectedValue(new Error('offline'));

    renderInACache(<BrowseArea kind="films" onPlay={vi.fn()} onInspect={vi.fn()} />);

    expect(await screen.findByText(/Nothing here stands on its own yet/)).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(BrowseArea.displayName).toBe('BrowseArea');
  });
});
