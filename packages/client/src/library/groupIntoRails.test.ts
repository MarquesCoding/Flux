import { describe, expect, it } from 'vitest';
import { groupIntoRails, inBroadcastOrder } from './groupIntoRails';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

const NOW = Date.parse('2026-08-10T00:00:00.000Z');

const daysAgo = (days: number): string => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

const media = (overrides: Partial<MediaSummary> = {}): MediaSummary => ({
  id: overrides.id ?? 'media-1',
  libraryId: 'library-1',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: daysAgo(1),
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  ...overrides,
});

const episode = (
  series: string,
  season: number,
  number: number,
  id = `${series}-${season}-${number}`,
) =>
  media({
    id,
    title: `${series} ${season.toString()}x${number.toString()}`,
    seriesTitle: series,
    seasonNumber: season,
    episodeNumber: number,
  });

describe('inBroadcastOrder', () => {
  it('puts episode two before episode ten, which sorting by name does not', () => {
    const ordered = [episode('S', 1, 10), episode('S', 1, 2)].sort(inBroadcastOrder);

    expect(ordered[0]?.episodeNumber).toBe(2);
  });

  it('puts an earlier season first', () => {
    const ordered = [episode('S', 2, 1), episode('S', 1, 9)].sort(inBroadcastOrder);

    expect(ordered[0]?.seasonNumber).toBe(1);
  });
});

describe('groupIntoRails', () => {
  it('has nothing to show for an empty library', () => {
    expect(groupIntoRails([], NOW)).toEqual([]);
  });

  it('opens with what arrived recently', () => {
    const rails = groupIntoRails(
      [media({ id: 'a' }), media({ id: 'b', addedAt: daysAgo(2) })],
      NOW,
    );

    expect(rails[0]?.title).toBe('Recently added');
    expect(rails[0]?.items[0]?.id).toBe('a');
  });

  it('leaves out a library that arrived long ago rather than calling it new', () => {
    const rails = groupIntoRails([media({ addedAt: daysAgo(400) })], NOW);

    expect(rails.map((rail) => rail.title)).not.toContain('Recently added');
  });

  it('gives a programme one row, not one row per season', () => {
    const rails = groupIntoRails(
      [
        episode('Some Show', 1, 1),
        episode('Some Show', 1, 2),
        episode('Some Show', 2, 1),
        episode('Some Show', 2, 2),
      ],
      NOW,
    );

    expect(rails.filter((rail) => rail.title === 'Some Show')).toHaveLength(1);
  });

  it('names that row after the programme rather than after a season of it', () => {
    const rails = groupIntoRails([episode('Some Show', 2, 1), episode('Some Show', 2, 2)], NOW);

    expect(rails.map((rail) => rail.title)).toContain('Some Show');
  });

  it('carries every season of a programme in that one row', () => {
    const rails = groupIntoRails(
      [
        episode('Some Show', 1, 1),
        episode('Some Show', 1, 2),
        episode('Some Show', 2, 1),
        episode('Some Show', 3, 1),
      ],
      NOW,
    );

    const show = rails.find((rail) => rail.title === 'Some Show');

    expect(show?.items.map((item) => item.seasonNumber)).toEqual([1, 1, 2, 3]);
  });

  it('runs the seasons on in the order they were broadcast', () => {
    const rails = groupIntoRails(
      [episode('Some Show', 2, 1), episode('Some Show', 1, 10), episode('Some Show', 1, 2)],
      NOW,
    );

    const show = rails.find((rail) => rail.title === 'Some Show');

    expect(show?.items.map((item) => item.title)).toEqual([
      'Some Show 1x2',
      'Some Show 1x10',
      'Some Show 2x1',
    ]);
  });

  it('holds more episodes than a row of picks, so a long programme is not cut off early', () => {
    const many = [...Array.from({ length: 40 }).keys()].map((at) =>
      episode('Some Show', 1, at + 1),
    );

    const rails = groupIntoRails(many, NOW);

    expect(rails.find((rail) => rail.title === 'Some Show')?.items).toHaveLength(40);
  });

  it('does not give a lone episode a row to itself', () => {
    const rails = groupIntoRails([episode('Some Show', 1, 1), media({ id: 'film' })], NOW);

    expect(rails.map((rail) => rail.title)).not.toContain('Some Show');
  });

  it('keeps a lone episode rather than losing it', () => {
    const rails = groupIntoRails([episode('Some Show', 1, 1, 'only')], NOW);

    expect(rails.flatMap((rail) => rail.items).some((item) => item.id === 'only')).toBe(true);
  });

  it('gathers everything that is not a series', () => {
    const rails = groupIntoRails(
      [media({ id: 'a', title: 'Zulu' }), media({ id: 'b', title: 'Alien' })],
      NOW,
    );

    const everything = rails.find((rail) => rail.id === 'everything');

    expect(everything?.items.map((item) => item.title)).toEqual(['Alien', 'Zulu']);
  });

  it('calls that row Films only when it is not the only row', () => {
    const alone = groupIntoRails([media({ addedAt: daysAgo(400) })], NOW);

    expect(alone[0]?.title).toBe('Everything');
  });

  it('keeps series apart from one another', () => {
    const rails = groupIntoRails(
      [
        episode('Show One', 1, 1),
        episode('Show One', 1, 2),
        episode('Show Two', 1, 1),
        episode('Show Two', 1, 2),
      ],
      NOW,
    );

    expect(rails.filter((rail) => rail.id.startsWith('series:'))).toHaveLength(2);
  });

  it('invents no row it cannot fill', () => {
    const rails = groupIntoRails([media()], NOW);

    expect(rails.every((rail) => rail.items.length > 0)).toBe(true);
  });

  it('gives every row a name that stays the same between renders', () => {
    const first = groupIntoRails([episode('S', 1, 1), episode('S', 1, 2)], NOW);
    const second = groupIntoRails([episode('S', 1, 2), episode('S', 1, 1)], NOW);

    expect(first.map((rail) => rail.id)).toEqual(second.map((rail) => rail.id));
  });
});

describe('a row that names a programme', () => {
  it('carries an episode of it, so the heading knows what it leads to', () => {
    const rails = groupIntoRails(
      [episode('Affection', 1, 1), episode('Affection', 1, 2)],
      Date.now(),
      new Map(),
    );

    const show = rails.find((rail) => rail.id.startsWith('series:'));

    expect(show?.showOf?.seriesTitle).toBe('Affection');
  });

  it('leads nowhere from a row that is about no one series', () => {
    const rails = groupIntoRails(
      [episode('Affection', 1, 1), episode('Affection', 1, 2)],
      Date.now(),
      new Map(),
    );

    expect(
      rails
        .filter((rail) => !rail.id.startsWith('series:'))
        .every((rail) => rail.showOf === undefined),
    ).toBe(true);
  });
});

describe('the rail of what somebody is partway through', () => {
  const partway = (id: string, updatedAt: string) =>
    [
      id,
      {
        mediaId: id,
        profileId: 'viewer-1',
        positionSeconds: 600,
        durationSeconds: 3600,
        isFinished: false,
        updatedAt,
      },
    ] as const;

  it('opens with what is being watched, before anything else', () => {
    const items = [media({ id: 'a' }), media({ id: 'b' })];
    const progress = new Map([partway('b', daysAgo(1))]);

    const rails = groupIntoRails(items, Date.now(), progress);

    expect(rails[0]).toMatchObject({ id: 'resume', title: 'Continue watching' });
    expect(rails[0]?.items.map((one) => one.id)).toEqual(['b']);
  });

  it('puts the most recently watched first', () => {
    const items = [media({ id: 'a' }), media({ id: 'b' })];
    const progress = new Map([partway('a', daysAgo(5)), partway('b', daysAgo(1))]);

    const rails = groupIntoRails(items, Date.now(), progress);

    expect(rails[0]?.items.map((one) => one.id)).toEqual(['b', 'a']);
  });

  it('treats a time it cannot read as long ago rather than as now', () => {
    const items = [media({ id: 'a' }), media({ id: 'b' })];
    const progress = new Map([partway('a', 'whenever'), partway('b', daysAgo(1))]);

    const rails = groupIntoRails(items, Date.now(), progress);

    expect(rails[0]?.items[0]?.id).toBe('b');
  });

  it('leaves out something barely started, which is not worth resuming', () => {
    const items = [media({ id: 'a' })];
    const progress = new Map([
      [
        'a',
        {
          mediaId: 'a',
          profileId: 'viewer-1',
          positionSeconds: 2,
          durationSeconds: 3600,
          isFinished: false,
          updatedAt: daysAgo(1),
        },
      ],
    ]);

    const rails = groupIntoRails(items, Date.now(), progress);

    expect(rails[0]?.id).not.toBe('resume');
  });

  it('has no such rail when nothing is partway through', () => {
    const rails = groupIntoRails([media({ id: 'a' })], Date.now());

    expect(rails.some((rail) => rail.id === 'resume')).toBe(false);
  });
});
