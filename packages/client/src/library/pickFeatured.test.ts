import { describe, expect, it } from 'vitest';
import {
  collapseToShows,
  pickFeatured,
  isEarlier,
  findSiblings,
  nextEpisode,
} from './pickFeatured';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

let counter = 0;

const itemOf = (changes: Partial<MediaSummary> = {}): MediaSummary => {
  counter += 1;

  return {
    id: `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`,
    libraryId: '00000000-0000-4000-8000-000000000000',
    title: 'Something',
    year: 2020,
    durationSeconds: 3600,
    width: 1920,
    height: 1080,
    videoCodec: 'h264',
    videoRange: 'sdr',
    addedAt: '2026-01-01T00:00:00.000Z',
    hasPoster: false,
    hasBackdrop: false,
    hasLogo: false,
    seriesId: null,
    ...changes,
  };
};

const episodeOf = (series: string, season: number, episode: number): MediaSummary =>
  itemOf({
    title: `${series} S${season.toString()}E${episode.toString()}`,
    seriesTitle: series,
    seasonNumber: season,
    episodeNumber: episode,
  });

describe('isEarlier', () => {
  it('puts an earlier season first', () => {
    expect(isEarlier(episodeOf('Show', 1, 9), episodeOf('Show', 2, 1))).toBe(true);
  });

  it('puts an earlier episode of the same season first', () => {
    expect(isEarlier(episodeOf('Show', 1, 1), episodeOf('Show', 1, 2))).toBe(true);
  });

  it('does not call a later episode earlier', () => {
    expect(isEarlier(episodeOf('Show', 2, 1), episodeOf('Show', 1, 9))).toBe(false);
  });
});

describe('pickFeatured', () => {
  it('lets a film stand for itself', () => {
    const film = itemOf({ title: 'Parasite' });

    expect(pickFeatured([film], 10)).toEqual([film]);
  });

  it('shows a series once rather than once per episode', () => {
    const featured = pickFeatured(
      [episodeOf('Show', 1, 1), episodeOf('Show', 1, 2), episodeOf('Show', 1, 3)],
      10,
    );

    expect(featured).toHaveLength(1);
  });

  it('introduces a series at its first episode', () => {
    const first = episodeOf('Show', 1, 1);
    const featured = pickFeatured([episodeOf('Show', 1, 9), first, episodeOf('Show', 2, 1)], 10);

    expect(featured).toEqual([first]);
  });

  it('keeps a show where its first file appeared, not where its first episode did', () => {
    const film = itemOf({ title: 'Parasite' });
    const featured = pickFeatured([episodeOf('Show', 1, 9), film, episodeOf('Show', 1, 1)], 10);

    expect(featured.map((item) => item.seriesTitle ?? item.title)).toEqual(['Show', 'Parasite']);
  });

  it('keeps two different shows apart', () => {
    const featured = pickFeatured([episodeOf('One', 1, 1), episodeOf('Two', 1, 1)], 10);

    expect(featured).toHaveLength(2);
  });

  it('stops at the number asked for', () => {
    expect(pickFeatured([itemOf(), itemOf(), itemOf()], 2)).toHaveLength(2);
  });

  it('has nothing to feature from nothing', () => {
    expect(pickFeatured([], 5)).toEqual([]);
  });
});

describe('findSiblings', () => {
  it('finds the rest of the season', () => {
    const open = episodeOf('Show', 1, 2);
    const siblings = findSiblings([episodeOf('Show', 1, 1), open, episodeOf('Show', 1, 3)], open);

    expect(siblings).toHaveLength(2);
  });

  it('leaves out the episode being read about', () => {
    const open = episodeOf('Show', 1, 2);
    const siblings = findSiblings([episodeOf('Show', 1, 1), open], open);

    expect(siblings.map((item) => item.id)).not.toContain(open.id);
  });

  it('puts them in broadcast order', () => {
    const open = episodeOf('Show', 1, 1);
    const siblings = findSiblings([open, episodeOf('Show', 1, 3), episodeOf('Show', 1, 2)], open);

    expect(siblings.map((item) => item.episodeNumber)).toEqual([2, 3]);
  });

  it('does not stray into another season', () => {
    const open = episodeOf('Show', 1, 1);
    const siblings = findSiblings([open, episodeOf('Show', 2, 1)], open);

    expect(siblings).toEqual([]);
  });

  it('does not stray into another show', () => {
    const open = episodeOf('Show', 1, 1);
    const siblings = findSiblings([open, episodeOf('Other', 1, 2)], open);

    expect(siblings).toEqual([]);
  });

  it('finds nothing for a film, which is not part of anything', () => {
    const film = itemOf();

    expect(findSiblings([film, itemOf()], film)).toEqual([]);
  });
});

describe('nextEpisode', () => {
  it('finds the one after this', () => {
    const second = episodeOf('Show', 1, 2);

    expect(
      nextEpisode([episodeOf('Show', 1, 1), second, episodeOf('Show', 1, 3)], second)
        ?.episodeNumber,
    ).toBe(3);
  });

  it('finds nothing after the last one there is', () => {
    const last = episodeOf('Show', 1, 2);

    expect(nextEpisode([episodeOf('Show', 1, 1), last], last)).toBeNull();
  });

  it('does not run on into the next season, which would be worse than stopping', () => {
    const finale = episodeOf('Show', 1, 2);

    expect(nextEpisode([finale, episodeOf('Show', 2, 1)], finale)).toBeNull();
  });

  it('does not run on into another show', () => {
    const finale = episodeOf('Show', 1, 1);

    expect(nextEpisode([finale, episodeOf('Other', 1, 2)], finale)).toBeNull();
  });

  it('has nothing to follow a film with', () => {
    const film = itemOf();

    expect(nextEpisode([film, itemOf()], film)).toBeNull();
  });

  it('skips a gap where an episode is missing from the library', () => {
    const first = episodeOf('Show', 1, 1);

    expect(nextEpisode([first, episodeOf('Show', 1, 4)], first)?.episodeNumber).toBe(4);
  });
});

describe('the episodes either side of one', () => {
  it('finds the rest of a season, in order', () => {
    const items = [
      episodeOf('Ted Lasso', 1, 3),
      episodeOf('Ted Lasso', 1, 1),
      episodeOf('Ted Lasso', 1, 2),
    ];

    const siblings = findSiblings(items, items[1] ?? items[0]!);

    expect(siblings.map((one) => one.episodeNumber)).toEqual([2, 3]);
  });

  it('leaves out another season, which is a different run of episodes', () => {
    const items = [episodeOf('Ted Lasso', 1, 1), episodeOf('Ted Lasso', 2, 1)];

    expect(findSiblings(items, items[0]!)).toEqual([]);
  });

  it('has no siblings for a film', () => {
    const film = itemOf({ title: 'Arrival' });

    expect(findSiblings([film, itemOf({ title: 'Heat' })], film)).toEqual([]);
  });

  it('answers with the next episode of the season', () => {
    const items = [episodeOf('Ted Lasso', 1, 1), episodeOf('Ted Lasso', 1, 2)];

    expect(nextEpisode(items, items[0]!)?.episodeNumber).toBe(2);
  });

  it('has nothing after the last episode there is', () => {
    const items = [episodeOf('Ted Lasso', 1, 1), episodeOf('Ted Lasso', 1, 2)];

    expect(nextEpisode(items, items[1]!)).toBeNull();
  });

  it('has nothing after a film, which is not part of a run', () => {
    const film = itemOf({ title: 'Arrival' });

    expect(nextEpisode([film], film)).toBeNull();
  });

  it('treats an episode with no number as coming before the numbered ones', () => {
    const unnumbered = itemOf({
      title: 'A special',
      seriesTitle: 'Ted Lasso',
      seasonNumber: 1,
    });
    const first = episodeOf('Ted Lasso', 1, 1);

    expect(findSiblings([unnumbered, first], first).map((one) => one.title)).toEqual(['A special']);
  });

  it('replaces a series already standing when an earlier episode turns up', () => {
    const featured = pickFeatured([episodeOf('Ted Lasso', 1, 5), episodeOf('Ted Lasso', 1, 1)], 5);

    expect(featured.map((one) => one.episodeNumber)).toEqual([1]);
  });
});

describe('collapseToShows', () => {
  it('draws a programme once however many episodes it has', () => {
    const items = Array.from({ length: 12 }, (_unused, at) => episodeOf('The Office', 1, at + 1));

    expect(collapseToShows(items)).toHaveLength(1);
  });

  it('stands the earliest episode in for the programme', () => {
    const items = [episodeOf('The Office', 2, 4), episodeOf('The Office', 1, 3)];

    expect(collapseToShows(items)[0]).toMatchObject({ seasonNumber: 1, episodeNumber: 3 });
  });

  it('leaves films alone, since there is nothing to group them under', () => {
    const items = [itemOf({ title: 'Heat' }), itemOf({ title: 'Arrival' })];

    expect(collapseToShows(items).map((one) => one.title)).toEqual(['Heat', 'Arrival']);
  });

  it('keeps the order things arrived in', () => {
    const items = [
      itemOf({ title: 'Heat' }),
      episodeOf('The Office', 1, 1),
      itemOf({ title: 'Arrival' }),
    ];

    expect(collapseToShows(items).map((one) => one.title)).toEqual([
      'Heat',
      'The Office S1E1',
      'Arrival',
    ]);
  });

  it('does not merge two programmes that share a title', () => {
    const items = [
      itemOf({ title: 'Pilot', seriesTitle: 'The Office', seriesId: 'uk', episodeNumber: 1 }),
      itemOf({ title: 'Pilot', seriesTitle: 'The Office', seriesId: 'us', episodeNumber: 1 }),
    ];

    expect(collapseToShows(items)).toHaveLength(2);
  });

  it('still groups a programme whose episodes carry no series id', () => {
    const items = [episodeOf('Poirot', 1, 1), episodeOf('Poirot', 1, 2)];

    expect(collapseToShows(items)).toHaveLength(1);
  });

  it('has nothing to collapse in an empty library', () => {
    expect(collapseToShows([])).toEqual([]);
  });
});
