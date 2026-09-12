import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@ValenceScreens/testing/renderInAShell';
import { BooksPage } from './BooksPage';
import type { BookShelfProps } from '@ValenceScreens/components/BookShelf/BookShelf.types';

const drawn = vi.hoisted((): { props: BookShelfProps | null } => ({ props: null }));

const mayAdminister = vi.hoisted(() => vi.fn<() => boolean>());

vi.mock('@ValenceClient/session/useWhatIMayDo', () => ({
  useWhatIMayDo: () => ({ may: () => false, mayAdminister: mayAdminister() }),
}));

beforeEach(() => {
  mayAdminister.mockReset().mockReturnValue(false);
});

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

  it('names the section for anybody reading the page, without a banner saying it again', () => {
    renderInAShell(<BooksPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Books' })).toHaveClass('sr-only');
    expect(screen.queryByText('Everything there is to read.')).not.toBeInTheDocument();
  });

  it('offers an administrator somewhere to add a library of books', async () => {
    mayAdminister.mockReturnValue(true);

    renderInAShell(<BooksPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Add a library' }));

    expect(drawn.props?.onAddLibrary).toBeDefined();
  });

  it('offers that to nobody who could not act on it', () => {
    renderInAShell(<BooksPage />);

    expect(drawn.props?.onAddLibrary).toBeUndefined();
  });

  it('offers nothing while the server has not yet said what this account may do', () => {
    renderInAShell(<BooksPage />);

    expect(drawn.props?.onAddLibrary).toBeUndefined();
  });
});
