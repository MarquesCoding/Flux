import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { PageReader } from './PageReader';
import type { Book, BookChapter } from '@FluxContracts/schemas/Book';

const held = new Map<string, string>();

const A_BOOK: Book = {
  id: 'a-book',
  libraryId: 'a-library',
  title: 'Rent-A-Girlfriend',
  layout: 'fixed',
  direction: 'rightToLeft',
  year: 2020,
  overview: null,
  genres: null,
  authors: null,
  rating: null,
  posterUrl: null,
  hasCover: true,
  chapterCount: 2,
  addedAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
};

const CHAPTERS: BookChapter[] = [
  {
    id: 'one',
    bookId: 'a-book',
    number: 1,
    title: 'Volume 1',
    format: 'cbz',
    pageCount: 10,
    addedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'two',
    bookId: 'a-book',
    number: 2,
    title: 'Volume 2',
    format: 'cbz',
    pageCount: 10,
    addedAt: '2026-08-20T00:00:00.000Z',
  },
];

const draw = (overrides: Partial<Parameters<typeof PageReader>[0]> = {}) =>
  render(
    <PageReader
      book={A_BOOK}
      chapters={CHAPTERS}
      chapterId="one"
      onChapterChange={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  );

const shown = (): string => screen.getByRole('img', { name: /^Page/ }).getAttribute('alt') ?? '';

beforeEach(() => {
  forgetPlatform();
  held.clear();
  installPlatform({
    store: {
      read: (key) => held.get(key) ?? null,
      write: (key, value) => {
        held.set(key, value);
      },
      forget: (key) => {
        held.delete(key);
      },
    },
    describeThisClient: () => 'Valence',
    thisClientId: () => 'a-client',
    openSocket: () => ({ send: () => {}, close: () => {} }),
  });
});

afterEach(() => {
  forgetPlatform();
});

describe('PageReader', () => {
  it('opens on the first page of a chapter', () => {
    draw();

    expect(shown()).toBe('Page 1');
  });

  it('opens where somebody left off', () => {
    draw({ startAtPage: 5 });

    expect(shown()).toBe('Page 6');
  });

  it('turns forward on the left arrow, because manga is read right to left', async () => {
    draw();

    await userEvent.keyboard('{ArrowLeft}');

    expect(shown()).toBe('Page 2');
  });

  it('turns back on the right arrow, for the same reason', async () => {
    draw({ startAtPage: 4 });

    await userEvent.keyboard('{ArrowRight}');

    expect(shown()).toBe('Page 4');
  });

  it('turns forward on the right arrow for a book read left to right', async () => {
    draw({ book: { ...A_BOOK, direction: 'leftToRight' } });

    await userEvent.keyboard('{ArrowRight}');

    expect(shown()).toBe('Page 2');
  });

  it('turns forward on the space bar, whichever way the book is read', async () => {
    draw();

    await userEvent.keyboard(' ');

    expect(shown()).toBe('Page 2');
  });

  it('will not turn back past the first page of the first chapter', async () => {
    draw();

    await userEvent.keyboard('{ArrowRight}');

    expect(shown()).toBe('Page 1');
  });

  it('moves to the next chapter when turning past the end', async () => {
    const onChapterChange = vi.fn();

    draw({ startAtPage: 9, onChapterChange });

    await userEvent.keyboard('{ArrowLeft}');

    expect(onChapterChange).toHaveBeenCalledWith('two');
  });

  it('moves to the chapter before when turning back off the front of one', async () => {
    const onChapterChange = vi.fn();

    draw({ chapterId: 'two', onChapterChange });

    await userEvent.keyboard('{ArrowRight}');

    expect(onChapterChange).toHaveBeenCalledWith('one');
  });

  it('says where somebody is up to, so it can be remembered', async () => {
    const onPageChange = vi.fn();

    draw({ onPageChange });
    onPageChange.mockClear();

    await userEvent.keyboard('{ArrowLeft}');

    expect(onPageChange).toHaveBeenCalledWith(1, false);
  });

  it('says when the last page was reached', () => {
    const onPageChange = vi.fn();

    draw({ startAtPage: 9, onPageChange });

    expect(onPageChange).toHaveBeenCalledWith(9, true);
  });

  it('leaves on escape', async () => {
    const onClose = vi.fn();

    draw({ onClose });

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('asks for a page at the width it will be drawn, not at full size', () => {
    draw();

    expect(screen.getByRole('img', { name: 'Page 1' }).getAttribute('src')).toContain('width=');
  });

  it('remembers how somebody likes to read, on the device', async () => {
    draw();

    await userEvent.click(screen.getByRole('button', { name: 'How to read' }));
    await userEvent.click(screen.getByText('Two pages'));

    expect(held.get('flux.reader')).toContain('"isDouble":true');
  });
});
