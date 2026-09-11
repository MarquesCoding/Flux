import { describe, expect, it } from 'vitest';
import { tasteOf } from './tasteOf';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

const media = (id: string, genres: string[] | null): MediaSummary => ({
  id,
  libraryId: 'library-1',
  title: id,
  year: 2020,
  durationSeconds: 3600,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-01-01T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
  genres,
});

describe('tasteOf', () => {
  it('puts the genre somebody has liked most first', () => {
    expect(
      tasteOf([
        media('a', ['Drama', 'Comedy']),
        media('b', ['Comedy']),
        media('c', ['Comedy', 'Thriller']),
      ]),
    ).toEqual(['Comedy', 'Drama', 'Thriller']);
  });

  it('settles a tie alphabetically, so it answers the same way every time', () => {
    expect(tasteOf([media('a', ['Thriller']), media('b', ['Action'])])).toEqual([
      'Action',
      'Thriller',
    ]);
  });

  it('passes over things that carry no genres at all', () => {
    expect(tasteOf([media('a', null), media('b', ['Horror'])])).toEqual(['Horror']);
  });

  it('knows nothing of somebody who has liked nothing', () => {
    expect(tasteOf([])).toEqual([]);
  });
});
