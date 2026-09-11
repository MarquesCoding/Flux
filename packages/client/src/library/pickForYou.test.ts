import { describe, expect, it } from 'vitest';
import { pickForYou } from './pickForYou';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

const media = (
  id: string,
  genres: string[] | null,
  rating: number | null = null,
): MediaSummary => ({
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
  rating,
});

const NOTHING_SEEN: ReadonlySet<string> = new Set();

const ids = (picked: MediaSummary[]): string[] => picked.map((one) => one.id);

describe('pickForYou', () => {
  it('prefers what shares the genre somebody likes most', () => {
    const picked = pickForYou(
      [media('comedy', ['Comedy']), media('drama', ['Drama'])],
      ['Drama', 'Comedy'],
      NOTHING_SEEN,
      10,
    );

    expect(ids(picked)).toEqual(['drama', 'comedy']);
  });

  it('counts every liked genre a thing shares, not only the first', () => {
    const picked = pickForYou(
      [media('drama', ['Drama']), media('both', ['Drama', 'Comedy'])],
      ['Drama', 'Comedy'],
      NOTHING_SEEN,
      10,
    );

    expect(ids(picked)).toEqual(['both', 'drama']);
  });

  it('does not suggest what somebody has already seen or kept', () => {
    const picked = pickForYou(
      [media('seen', ['Drama']), media('new', ['Drama'])],
      ['Drama'],
      new Set(['seen']),
      10,
    );

    expect(ids(picked)).toEqual(['new']);
  });

  it('suggests a thing once, however often it turns up among the candidates', () => {
    const film = media('film', ['Drama']);

    expect(ids(pickForYou([film, film], ['Drama'], NOTHING_SEEN, 10))).toEqual(['film']);
  });

  it('leaves out what shares nothing with somebody’s taste', () => {
    const picked = pickForYou(
      [media('horror', ['Horror']), media('bare', null), media('drama', ['Drama'])],
      ['Drama'],
      NOTHING_SEEN,
      10,
    );

    expect(ids(picked)).toEqual(['drama']);
  });

  it('puts the better-rated first where two share as much', () => {
    const picked = pickForYou(
      [media('fair', ['Drama'], 6), media('fine', ['Drama'], 8)],
      ['Drama'],
      NOTHING_SEEN,
      10,
    );

    expect(ids(picked)).toEqual(['fine', 'fair']);
  });

  it('stops at the number asked for', () => {
    const picked = pickForYou(
      ['a', 'b', 'c', 'd'].map((id) => media(id, ['Drama'])),
      ['Drama'],
      NOTHING_SEEN,
      2,
    );

    expect(picked).toHaveLength(2);
  });

  it('suggests nothing to somebody with no taste on record', () => {
    expect(pickForYou([media('drama', ['Drama'])], [], NOTHING_SEEN, 10)).toEqual([]);
  });
});
