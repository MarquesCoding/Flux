import { describe, expect, it } from 'vitest';
import { mediaKindOf } from './mediaKindOf';

describe('mediaKindOf', () => {
  it('calls something with no series behind it a film', () => {
    expect(mediaKindOf({ seriesTitle: null }, 'movies')).toBe('movie');
  });

  it('calls something with a series behind it an episode', () => {
    expect(mediaKindOf({ seriesTitle: 'The Bear' }, 'shows')).toBe('episode');
  });

  it('calls a film in a shows library a film, because the library is not the item', () => {
    expect(mediaKindOf({ seriesTitle: null }, 'shows')).toBe('movie');
  });

  it('calls anything in a books library a book, series or not', () => {
    expect(mediaKindOf({ seriesTitle: 'Berserk' }, 'books')).toBe('book');
  });

  it('calls anything in a music library a song', () => {
    expect(mediaKindOf({ seriesTitle: null }, 'music')).toBe('song');
  });
});
