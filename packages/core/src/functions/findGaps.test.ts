import { describe, expect, it } from 'vitest';
import { findGaps } from './findGaps';
import type { ShowDetail } from '@FluxContracts/schemas/Show';

const episode = (seasonNumber: number | null, episodeNumber: number | null) => ({
  id: `${(seasonNumber ?? 0).toString()}-${(episodeNumber ?? 0).toString()}`,
  libraryId: '11111111-1111-4111-8111-111111111111',
  title: 'An episode',
  year: 2024,
  durationSeconds: 1400,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
  seriesTitle: 'A Sign of Affection',
  seasonNumber,
  episodeNumber,
});

const show = (seasons: { seasonNumber: number | null; episodes: number[] }[]): ShowDetail => ({
  id: 'a-sign-of-affection',
  libraryId: '11111111-1111-4111-8111-111111111111',
  title: 'A Sign of Affection',
  seasonCount: seasons.length,
  episodeCount: seasons.reduce((count, season) => count + season.episodes.length, 0),
  latestAddedAt: '2026-08-10T00:00:00.000Z',
  coverMediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  year: 2024,
  rating: 8.1,
  genres: [],
  seasons: seasons.map((season) => ({
    seasonNumber: season.seasonNumber,
    episodes: season.episodes.map((number) => episode(season.seasonNumber, number)),
  })),
});

describe('findGaps, told what the series contains', () => {
  const withShape = (
    seasons: { seasonNumber: number; episodes: number[] }[],
    shape: { seasonNumber: number; episodeCount: number }[],
  ): ShowDetail => ({
    ...show(seasons),
    shape: shape.map((season) => ({
      ...season,
      episodes: Array.from({ length: season.episodeCount }, (_, index) => ({
        episodeNumber: index + 1,
        title: `Episode ${(index + 1).toString()}`,
        stillUrl: null,
        overview: null,
      })),
    })),
  });

  it('sees the episodes missing off the end of a season', () => {
    const gaps = findGaps(
      withShape([{ seasonNumber: 1, episodes: [1, 2, 3] }], [{ seasonNumber: 1, episodeCount: 5 }]),
    );

    expect(gaps.episodes.get(1)).toEqual([4, 5]);
  });

  it('sees a season held by nobody, which numbering alone never could', () => {
    const gaps = findGaps(
      withShape(
        [{ seasonNumber: 1, episodes: [1] }],
        [
          { seasonNumber: 1, episodeCount: 1 },
          { seasonNumber: 2, episodeCount: 12 },
        ],
      ),
    );

    expect(gaps.seasons).toEqual([2]);
  });

  it('counts specials like any other season once a catalogue names them', () => {
    const gaps = findGaps(
      withShape(
        [{ seasonNumber: 1, episodes: [1] }],
        [
          { seasonNumber: 0, episodeCount: 2 },
          { seasonNumber: 1, episodeCount: 1 },
        ],
      ),
    );

    expect(gaps.seasons).toContain(0);
  });

  it('says a complete series is complete', () => {
    const gaps = findGaps(
      withShape([{ seasonNumber: 1, episodes: [1, 2] }], [{ seasonNumber: 1, episodeCount: 2 }]),
    );

    expect(gaps.seasons).toEqual([]);
    expect(gaps.episodes.size).toBe(0);
  });

  it('ignores a season the catalogue says is empty, which is one not yet aired', () => {
    const gaps = findGaps(
      withShape(
        [{ seasonNumber: 1, episodes: [1] }],
        [
          { seasonNumber: 1, episodeCount: 1 },
          { seasonNumber: 2, episodeCount: 0 },
        ],
      ),
    );

    expect(gaps.seasons).toEqual([]);
  });

  it('says where its answer came from', () => {
    const told = findGaps(
      withShape([{ seasonNumber: 1, episodes: [1] }], [{ seasonNumber: 1, episodeCount: 2 }]),
    );

    expect(told.isFromCatalogue).toBe(true);
    expect(findGaps(show([{ seasonNumber: 1, episodes: [1] }])).isFromCatalogue).toBe(false);
  });
});

describe('findGaps', () => {
  it('finds an episode skipped in the middle of a season', () => {
    const gaps = findGaps(show([{ seasonNumber: 1, episodes: [1, 2, 4] }]));

    expect(gaps.episodes.get(1)).toEqual([3]);
  });

  it('finds several in a row', () => {
    const gaps = findGaps(show([{ seasonNumber: 1, episodes: [1, 5] }]));

    expect(gaps.episodes.get(1)).toEqual([2, 3, 4]);
  });

  it('says nothing about a season with no holes in it', () => {
    const gaps = findGaps(show([{ seasonNumber: 1, episodes: [1, 2, 3] }]));

    expect(gaps.episodes.has(1)).toBe(false);
  });

  it('does not guess at episodes past the last one held', () => {
    const gaps = findGaps(show([{ seasonNumber: 1, episodes: [1, 2, 3] }]));

    expect(gaps.episodes.get(1)).toBeUndefined();
  });

  it('does not guess at episodes before the first one held', () => {
    const gaps = findGaps(show([{ seasonNumber: 1, episodes: [4, 5] }]));

    expect(gaps.episodes.has(1)).toBe(false);
  });

  it('reads each season on its own', () => {
    const gaps = findGaps(
      show([
        { seasonNumber: 1, episodes: [1, 3] },
        { seasonNumber: 2, episodes: [1, 2] },
      ]),
    );

    expect(gaps.episodes.get(1)).toEqual([2]);
    expect(gaps.episodes.has(2)).toBe(false);
  });

  it('finds a season missing between two that are held', () => {
    const gaps = findGaps(
      show([
        { seasonNumber: 1, episodes: [1] },
        { seasonNumber: 3, episodes: [1] },
      ]),
    );

    expect(gaps.seasons).toEqual([2]);
  });

  it('says nothing about seasons when they run consecutively', () => {
    const gaps = findGaps(
      show([
        { seasonNumber: 1, episodes: [1] },
        { seasonNumber: 2, episodes: [1] },
      ]),
    );

    expect(gaps.seasons).toEqual([]);
  });

  it('does not call a series that starts at season 2 missing season 1', () => {
    const gaps = findGaps(show([{ seasonNumber: 2, episodes: [1] }]));

    expect(gaps.seasons).toEqual([]);
  });

  it('leaves specials alone, since nobody numbers them the same way', () => {
    const gaps = findGaps(show([{ seasonNumber: 0, episodes: [1, 2, 5] }]));

    expect(gaps.episodes.size).toBe(0);
  });

  it('leaves an unnumbered season alone', () => {
    const gaps = findGaps(show([{ seasonNumber: null, episodes: [1, 4] }]));

    expect(gaps.episodes.size).toBe(0);
  });

  it('ignores an episode with no number rather than counting it as nought', () => {
    const withUnnumbered: ShowDetail = {
      ...show([{ seasonNumber: 1, episodes: [1, 3] }]),
      seasons: [{ seasonNumber: 1, episodes: [episode(1, 1), episode(1, null), episode(1, 3)] }],
    };

    expect(findGaps(withUnnumbered).episodes.get(1)).toEqual([2]);
  });

  it('finds nothing in a series with no seasons at all', () => {
    const gaps = findGaps(show([]));

    expect(gaps.seasons).toEqual([]);
    expect(gaps.episodes.size).toBe(0);
  });
});
