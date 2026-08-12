import { describe, expect, it } from 'vitest';
import { groupIntoShows, buildShowDetail } from './groupIntoShows';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const episode = (overrides: Partial<MediaSummary> = {}): MediaSummary => ({
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f',
  title: 'Yuki’s World',
  year: 2024,
  durationSeconds: 1421,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-01T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  seriesTitle: 'A Sign of Affection',
  seasonNumber: 1,
  episodeNumber: 1,
  ...overrides,
});

const identified = (at: number) =>
  `9c858901-8a57-4791-81fe-4c455b0999${at.toString().padStart(2, '0')}`;

describe('groupIntoShows', () => {
  it('says a series once, however many episodes it has', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), episodeNumber: 1 }),
      episode({ id: identified(2), episodeNumber: 2 }),
      episode({ id: identified(3), episodeNumber: 3 }),
    ]);

    expect(shows).toHaveLength(1);
    expect(shows[0]?.title).toBe('A Sign of Affection');
    expect(shows[0]?.episodeCount).toBe(3);
  });

  it('counts the seasons it holds', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), seasonNumber: 1 }),
      episode({ id: identified(2), seasonNumber: 2 }),
    ]);

    expect(shows[0]?.seasonCount).toBe(2);
  });

  it('stands for a series with the episode that opens it', () => {
    const shows = groupIntoShows([
      episode({ id: identified(9), episodeNumber: 9 }),
      episode({ id: identified(1), episodeNumber: 1 }),
    ]);

    expect(shows[0]?.coverMediaId).toBe(identified(1));
  });

  it('remembers when the most recent episode arrived', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), addedAt: '2026-01-01T00:00:00.000Z' }),
      episode({ id: identified(2), addedAt: '2026-08-09T00:00:00.000Z' }),
    ]);

    expect(shows[0]?.latestAddedAt).toBe('2026-08-09T00:00:00.000Z');
  });

  it('puts what arrived most recently first', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), seriesTitle: 'Older', addedAt: '2020-01-01T00:00:00.000Z' }),
      episode({ id: identified(2), seriesTitle: 'Newer', addedAt: '2026-08-09T00:00:00.000Z' }),
    ]);

    expect(shows.map((show) => show.title)).toEqual(['Newer', 'Older']);
  });

  it('takes what a catalogue said from whichever episode carries it', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), rating: null, genres: [] }),
      episode({ id: identified(2), episodeNumber: 2, rating: 8.1, genres: ['Animation'] }),
    ]);

    expect(shows[0]?.rating).toBe(8.1);
    expect(shows[0]?.genres).toEqual(['Animation']);
  });

  it('leaves films alone, since a film is not a series of one', () => {
    expect(groupIntoShows([episode({ seriesTitle: null })])).toEqual([]);
  });

  it('treats a series named two ways as one series', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), seriesTitle: 'A Sign of Affection' }),
      episode({ id: identified(2), seriesTitle: 'a sign of affection' }),
    ]);

    expect(shows).toHaveLength(1);
  });
});

describe('buildShowDetail', () => {
  it('lays a series out season by season', () => {
    const show = buildShowDetail(
      [
        episode({ id: identified(1), seasonNumber: 2, episodeNumber: 1 }),
        episode({ id: identified(2), seasonNumber: 1, episodeNumber: 2 }),
        episode({ id: identified(3), seasonNumber: 1, episodeNumber: 1 }),
      ],
      'a-sign-of-affection',
    );

    expect(show?.seasons.map((season) => season.seasonNumber)).toEqual([1, 2]);
    expect(show?.seasons[0]?.episodes.map((one) => one.episodeNumber)).toEqual([1, 2]);
  });

  it('puts a season nobody numbered after the ones somebody did', () => {
    const show = buildShowDetail(
      [
        episode({ id: identified(1), seasonNumber: null }),
        episode({ id: identified(2), seasonNumber: 1 }),
      ],
      'a-sign-of-affection',
    );

    expect(show?.seasons.map((season) => season.seasonNumber)).toEqual([1, null]);
  });

  it('answers with nothing for a series the library does not hold', () => {
    expect(buildShowDetail([episode()], 'something-else')).toBeNull();
  });
});

describe('the ordering an episode list is read in', () => {
  it('puts a later season after an earlier one, whatever the episodes are called', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), seasonNumber: 2, episodeNumber: 1, title: 'A' }),
      episode({ id: identified(2), seasonNumber: 1, episodeNumber: 9, title: 'Z' }),
    ]);

    expect(shows[0]?.coverMediaId).toBe(identified(2));
  });

  it('falls back to the title when two episodes claim the same number', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), episodeNumber: 1, title: 'Second' }),
      episode({ id: identified(2), episodeNumber: 1, title: 'First' }),
    ]);

    expect(shows[0]?.coverMediaId).toBe(identified(2));
  });

  it('treats an episode with no number as coming before the numbered ones', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), episodeNumber: 3 }),
      episode({ id: identified(2), episodeNumber: null, title: 'A special' }),
    ]);

    expect(shows[0]?.coverMediaId).toBe(identified(2));
  });

  it('treats a date it cannot read as long ago rather than as now', () => {
    const shows = groupIntoShows([
      episode({ id: identified(1), addedAt: 'whenever', episodeNumber: 1 }),
      episode({ id: identified(2), addedAt: '2026-08-02T00:00:00.000Z', episodeNumber: 2 }),
    ]);

    expect(shows[0]?.latestAddedAt).toBe('2026-08-02T00:00:00.000Z');
  });

  it('has no year for a series whose episodes all lack one', () => {
    const shows = groupIntoShows([episode({ year: null })]);

    expect(shows[0]?.year).toBeNull();
  });
});
