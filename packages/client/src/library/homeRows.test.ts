import { describe, expect, it } from 'vitest';
import { homeRows, ROW_LIMIT } from './homeRows';
import type { HomeRowsInput } from './homeRows';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

const media = (id: string, changes: Partial<MediaSummary> = {}): MediaSummary => ({
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
  ...changes,
});

const episode = (id: string, season: number, number: number): MediaSummary =>
  media(id, {
    seriesId: 'series-1',
    seriesTitle: 'The Programme',
    seasonNumber: season,
    episodeNumber: number,
  });

const many = (prefix: string, count: number): MediaSummary[] =>
  Array.from({ length: count }, (_, at) => media(`${prefix}-${at.toString()}`));

const input = (changes: Partial<HomeRowsInput> = {}): HomeRowsInput => ({
  resuming: [],
  picked: [],
  recent: [],
  acclaimed: [],
  genres: [],
  ...changes,
});

describe('homeRows', () => {
  it('lays the rows out in the order the page is browsed by', () => {
    const rows = homeRows(
      input({
        resuming: many('resume', 4),
        picked: many('picked', 4),
        recent: many('recent', 4),
        acclaimed: many('acclaimed', 4),
        genres: [
          { genre: 'Drama', items: many('drama', 4) },
          { genre: 'Comedy', items: many('comedy', 4) },
        ],
      }),
    );

    expect(rows.map((row) => row.title)).toEqual([
      'Continue watching',
      'Picked for you',
      'Recently added',
      'Critically acclaimed',
      'Drama',
      'Comedy',
    ]);
    expect(rows.map((row) => row.id)).toEqual([
      'resume',
      'picked',
      'recent',
      'acclaimed',
      'genre:Drama',
      'genre:Comedy',
    ]);
  });

  it('holds no row longer than its limit, however much there is', () => {
    const [recent] = homeRows(input({ recent: many('recent', 40) }));

    expect(recent?.items).toHaveLength(ROW_LIMIT);
  });

  it('leaves out a row too thin to be worth scrolling', () => {
    const rows = homeRows(
      input({
        picked: many('picked', 3),
        acclaimed: many('acclaimed', 3),
        genres: [{ genre: 'Drama', items: many('d', 3) }],
      }),
    );

    expect(rows).toEqual([]);
  });

  it('draws Recently added with even one thing in it, since every library has something new', () => {
    const rows = homeRows(input({ recent: [media('only')] }));

    expect(rows.map((row) => row.id)).toEqual(['recent']);
  });

  it('keeps a single thing to carry on with, since that one thing is the point', () => {
    const rows = homeRows(input({ resuming: [media('half-watched')] }));

    expect(rows.map((row) => row.id)).toEqual(['resume']);
  });

  it('stands a programme as one card, at the episode it begins with', () => {
    const [recent] = homeRows(
      input({
        recent: [episode('second', 1, 2), episode('first', 1, 1), ...many('film', 3)],
      }),
    );

    expect(recent?.items.map((item) => item.id)).toEqual(['first', 'film-0', 'film-1', 'film-2']);
  });

  it('keeps each episode as itself in Continue watching, since which one is the point', () => {
    const [resume] = homeRows(input({ resuming: [episode('two', 1, 2), episode('three', 1, 3)] }));

    expect(resume?.items.map((item) => item.id)).toEqual(['two', 'three']);
  });

  it('lets one film stand in more than one row', () => {
    const shared = media('shared');
    const rows = homeRows(
      input({
        recent: [shared, ...many('recent', 3)],
        acclaimed: [shared, ...many('acclaimed', 3)],
      }),
    );

    expect(rows.every((row) => row.items.some((item) => item.id === 'shared'))).toBe(true);
  });

  it('shows a thing once within a row', () => {
    const repeated = media('repeated');
    const [recent] = homeRows(input({ recent: [repeated, repeated, ...many('recent', 3)] }));

    expect(recent?.items.map((item) => item.id)).toEqual([
      'repeated',
      'recent-0',
      'recent-1',
      'recent-2',
    ]);
  });

  it('has no rows for a server with nothing to show', () => {
    expect(homeRows(input())).toEqual([]);
  });
});
