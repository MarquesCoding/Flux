import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@ValenceScreens/testing/renderInAShell';
import { BooksPage } from './BooksPage';
import type { BookShelfProps } from '@ValenceScreens/components/BookShelf/BookShelf.types';

const drawn = vi.hoisted((): { props: BookShelfProps | null } => ({ props: null }));

vi.mock('@ValenceScreens/components/BookShelf/BookShelf', () => ({
  BookShelf: (props: BookShelfProps) => {
    drawn.props = props;

    return props.onAddLibrary === undefined ? (
      <p>shelf</p>
    ) : (
      <button type="button" onClick={props.onAddLibrary}>
        Add a library
      </button>
    );
  },
}));

describe('BooksPage', () => {
  it('names itself, as every other section does', () => {
    renderInAShell(<BooksPage />);

    expect(screen.getByRole('heading', { name: 'Books', level: 1 })).toBeInTheDocument();
  });

  it('says what the section is for beneath its name', () => {
    renderInAShell(<BooksPage />);

    expect(screen.getByText('Everything there is to read.')).toBeInTheDocument();
  });

  it('offers an administrator somewhere to add a library of books', async () => {
    renderInAShell(<BooksPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Add a library' }));

    expect(drawn.props?.onAddLibrary).toBeDefined();
  });

  it('offers that to nobody who could not act on it', () => {
    renderInAShell(<BooksPage />, {
      user: {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Watcher',
        email: 'watcher@valence.test',
        role: 'user',
        image: null,
        emailVerified: true,
      },
    });

    expect(drawn.props?.onAddLibrary).toBeUndefined();
  });
});
