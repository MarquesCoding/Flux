import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookCoverUrl, bookPageUrl, saveReadingProgress } from './fetchBooks';

const fetchMock = vi.fn<(input: string, options?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bookPageUrl', () => {
  it('names a page, counting from zero as the archive does', () => {
    expect(bookPageUrl('a-book', 'a-chapter', 0)).toBe(
      '/api/books/a-book/chapters/a-chapter/pages/0',
    );
  });

  it('asks for the width it will be drawn at, since a page is megabytes of picture', () => {
    expect(bookPageUrl('a-book', 'a-chapter', 4, 1080)).toBe(
      '/api/books/a-book/chapters/a-chapter/pages/4?width=1080',
    );
  });

  it('rounds a width, because a screen measured in a browser is rarely whole', () => {
    expect(bookPageUrl('a-book', 'a-chapter', 4, 1079.6)).toContain('width=1080');
  });
});

describe('bookCoverUrl', () => {
  it('names the cover', () => {
    expect(bookCoverUrl('a-book')).toBe('/api/books/a-book/cover');
  });
});

describe('saveReadingProgress', () => {
  it('says where somebody is up to', async () => {
    await saveReadingProgress('a-book', 'a-chapter', 12);

    const [address, options] = fetchMock.mock.calls[0] ?? [];

    expect(address).toBe('/api/books/a-book/chapters/a-chapter/progress');
    expect(options?.method).toBe('PUT');
    expect(typeof options?.body === 'string' ? options.body : '').toContain('"pageNumber":12');
  });

  it('sends no fraction, which is for text that reflows and not for a page', async () => {
    await saveReadingProgress('a-book', 'a-chapter', 12);

    const sent = fetchMock.mock.calls[0]?.[1]?.body;

    expect(typeof sent === 'string' ? sent : '').toContain('"fraction":null');
  });

  it('says when that was the last page', async () => {
    await saveReadingProgress('a-book', 'a-chapter', 193, true);

    const sent = fetchMock.mock.calls[0]?.[1]?.body;

    expect(typeof sent === 'string' ? sent : '').toContain('"isFinished":true');
  });

  it('does not throw when the server cannot be reached, since a turn should not stutter', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    expect(await saveReadingProgress('a-book', 'a-chapter', 12)).toBe(false);
  });

  it('says so when the server refused it', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    expect(await saveReadingProgress('a-book', 'a-chapter', 12)).toBe(false);
  });
});
