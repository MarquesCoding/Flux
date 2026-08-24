import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { BookShelf } from './BookShelf';
import type { Library } from '@ValenceContracts/schemas/Library';

const fetchLibrariesMock = vi.hoisted(() => vi.fn());
const fetchBooksMock = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/library/fetchLibrary', () => ({
  fetchLibraries: fetchLibrariesMock,
  fetchLibraryItems: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
  fetchMediaDetail: vi.fn(),
}));

vi.mock('@ValenceClient/books/fetchBooks', () => ({
  fetchBooks: fetchBooksMock,
  bookCoverUrl: (bookId: string) => `/api/books/${bookId}/cover`,
}));

const aShelf = (over: Partial<Library> = {}): Library => ({
  id: 'ff6da66a-4e1b-43c2-ba99-8aa833a422f2',
  name: 'Manga',
  kind: 'books',
  path: '/media/books',
  itemCount: 0,
  lastScannedAt: null,
  defaultAudioLanguage: null,
  filesAtOnce: null,
  ...over,
});

beforeEach(() => {
  fetchLibrariesMock.mockReset();
  fetchBooksMock.mockReset();
  fetchLibrariesMock.mockResolvedValue([aShelf()]);
  fetchBooksMock.mockResolvedValue([]);
});

describe('BookShelf', () => {
  it('says a shelf that exists and holds nothing is empty, rather than drawing nothing at all', async () => {
    renderInAnAddress(<BookShelf onOpen={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Nothing to read yet' })).toBeInTheDocument();
  });

  it('tells that to somebody who cannot fix it as something to ask about', async () => {
    renderInAnAddress(<BookShelf onOpen={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Nothing to read yet' });

    expect(screen.getByText('Ask the server admin to scan it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scan it' })).not.toBeInTheDocument();
  });

  it('pushes an administrator at the two things that would fix it', async () => {
    const manage = vi.fn();

    renderInAnAddress(<BookShelf onOpen={vi.fn()} onAddLibrary={manage} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Scan it' }));

    expect(manage).toHaveBeenCalledTimes(1);
  });

  it('says no library has been added when there is none, which is a different problem', async () => {
    fetchLibrariesMock.mockResolvedValue([]);

    renderInAnAddress(<BookShelf onOpen={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'No book libraries yet' }),
    ).toBeInTheDocument();
  });

  it('draws the shelves once anything is on them', async () => {
    fetchBooksMock.mockResolvedValue([
      {
        id: '4d1b6cf4-2f3e-4b2a-9a0e-1f5a6b7c8d9e',
        libraryId: aShelf().id,
        title: 'Berserk',
        layout: 'fixed',
        direction: 'rightToLeft',
        year: null,
        overview: null,
        genres: null,
        authors: null,
        rating: null,
        hasCover: true,
        chapterCount: 1,
        addedAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
    ]);

    renderInAnAddress(<BookShelf onOpen={vi.fn()} />);

    expect(await screen.findByText('Manga')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nothing to read yet' })).not.toBeInTheDocument();
  });
});
