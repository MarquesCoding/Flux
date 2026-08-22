import { describe, expect, it } from 'vitest';
import { intoSeasons } from './intoSeasons';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

const episode = (over: Partial<MediaSummary>): MediaSummary => ({
  id: 'x',
  libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'An Episode',
  year: 2024,
  durationSeconds: 1800,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: 'show-1',
  ...over,
});

describe('intoSeasons', () => {
  it('gathers episodes into the season they belong to', () => {
    const seasons = intoSeasons([
      episode({ id: 'a', seasonNumber: 1, episodeNumber: 1 }),
      episode({ id: 'b', seasonNumber: 2, episodeNumber: 1 }),
      episode({ id: 'c', seasonNumber: 1, episodeNumber: 2 }),
    ]);

    expect(seasons.map((one) => one.seasonNumber)).toEqual([1, 2]);
    expect(seasons[0]?.episodes.map((one) => one.id)).toEqual(['a', 'c']);
  });

  it('puts each season’s episodes in the order they were broadcast', () => {
    const seasons = intoSeasons([
      episode({ id: 'second', seasonNumber: 1, episodeNumber: 2 }),
      episode({ id: 'first', seasonNumber: 1, episodeNumber: 1 }),
    ]);

    expect(seasons[0]?.episodes.map((one) => one.id)).toEqual(['first', 'second']);
  });

  it('keeps the seasons themselves in order, however they arrived', () => {
    const seasons = intoSeasons([
      episode({ id: 'later', seasonNumber: 3, episodeNumber: 1 }),
      episode({ id: 'earlier', seasonNumber: 1, episodeNumber: 1 }),
    ]);

    expect(seasons.map((one) => one.seasonNumber)).toEqual([1, 3]);
  });

  it('gathers episodes the scanner could not place rather than dropping them', () => {
    const seasons = intoSeasons([episode({ id: 'stray', episodeNumber: 1 })]);

    expect(seasons).toHaveLength(1);
    expect(seasons[0]?.seasonNumber).toBeNull();
  });

  it('has nothing to show for nothing', () => {
    expect(intoSeasons([])).toEqual([]);
  });
});
