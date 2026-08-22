import { describe, expect, it } from 'vitest';
import { groupBareNumberedEpisodes } from './groupBareNumberedEpisodes';

const YAMADA = [
  '/media/Yamada-kun [Bluray]/Yamada-kun to Lv999 no Koi wo Suru - 01 [Bluray.1080p].mkv',
  '/media/Yamada-kun [Bluray]/Yamada-kun to Lv999 no Koi wo Suru - 02 [Bluray.1080p].mkv',
  '/media/Yamada-kun [Bluray]/Yamada-kun to Lv999 no Koi wo Suru - 03 [Bluray.1080p].mkv',
];

describe('groupBareNumberedEpisodes', () => {
  it('reads a run of files that never wrote S01E01', () => {
    const found = groupBareNumberedEpisodes(YAMADA);

    expect([...found.values()].map((one) => one.episodeNumber)).toEqual([1, 2, 3]);
  });

  it('names the programme after the words the files agree on', () => {
    const found = groupBareNumberedEpisodes(YAMADA);

    expect(found.get(YAMADA[0] ?? '')?.seriesTitle).toBe('Yamada-kun to Lv999 no Koi wo Suru');
  });

  it('calls it season one when nothing says otherwise', () => {
    expect(groupBareNumberedEpisodes(YAMADA).get(YAMADA[0] ?? '')?.seasonNumber).toBe(1);
  });

  it('takes the season from the folder where the folder says', () => {
    const found = groupBareNumberedEpisodes([
      '/media/Some Show/Season 3/Some Show - 01.mkv',
      '/media/Some Show/Season 3/Some Show - 02.mkv',
    ]);

    expect([...found.values()][0]?.seasonNumber).toBe(3);
  });

  it('leaves a film with a number in its name alone', () => {
    const found = groupBareNumberedEpisodes([
      '/media/Blade Runner 2049 2017 1080p BluRay x265.mkv',
      '/media/Oceans 11 2001 1080p BluRay x265.mkv',
    ]);

    expect(found.size).toBe(0);
  });

  it('will not make a programme out of one file', () => {
    expect(groupBareNumberedEpisodes([YAMADA[0] ?? '']).size).toBe(0);
  });

  it('will not make a programme out of the same number twice', () => {
    const found = groupBareNumberedEpisodes([
      '/media/Thing/Thing - 01 [1080p].mkv',
      '/media/Thing/Thing - 01 [720p].mkv',
    ]);

    expect(found.size).toBe(0);
  });

  it('keeps two programmes in one folder apart', () => {
    const found = groupBareNumberedEpisodes([
      '/media/Anime/Show One - 01.mkv',
      '/media/Anime/Show One - 02.mkv',
      '/media/Anime/Show Two - 01.mkv',
      '/media/Anime/Show Two - 02.mkv',
    ]);

    expect(new Set([...found.values()].map((one) => one.seriesTitle))).toEqual(
      new Set(['Show One', 'Show Two']),
    );
  });

  it('keeps the same programme in two folders apart, since a folder is a season', () => {
    const found = groupBareNumberedEpisodes([
      '/media/Show/Season 1/Show - 01.mkv',
      '/media/Show/Season 1/Show - 02.mkv',
      '/media/Show/Season 2/Show - 01.mkv',
      '/media/Show/Season 2/Show - 02.mkv',
    ]);

    expect(new Set([...found.values()].map((one) => one.seasonNumber))).toEqual(new Set([1, 2]));
  });

  it('does not mistake digits welded to a word for an episode number', () => {
    const found = groupBareNumberedEpisodes([
      '/media/Lv999/Yamada Lv999 - 01.mkv',
      '/media/Lv999/Yamada Lv999 - 02.mkv',
    ]);

    expect([...found.values()][0]?.seriesTitle).toBe('Yamada Lv999');
  });

  it('has nothing to say about an empty library', () => {
    expect(groupBareNumberedEpisodes([]).size).toBe(0);
  });

  it('reads a run of files that carry no extension at all', () => {
    const found = groupBareNumberedEpisodes(['/media/Show/Show - 01', '/media/Show/Show - 02']);

    expect(found.size).toBe(2);
  });

  it('reads a run sitting at the top of the library rather than in a folder', () => {
    const found = groupBareNumberedEpisodes(['Show - 01.mkv', 'Show - 02.mkv']);

    expect([...found.values()][0]?.seriesTitle).toBe('Show');
  });

  it('ignores a file that is nothing but a number', () => {
    expect(groupBareNumberedEpisodes(['/media/Show/01.mkv', '/media/Show/02.mkv']).size).toBe(0);
  });

  it('ignores a file with no number in it at all', () => {
    expect(
      groupBareNumberedEpisodes(['/media/Show/Pilot.mkv', '/media/Show/Finale.mkv']).size,
    ).toBe(0);
  });

  it('calls a specials folder season zero, the way the rest of Valence does', () => {
    const found = groupBareNumberedEpisodes([
      '/media/Show/Specials/Show - 01.mkv',
      '/media/Show/Specials/Show - 02.mkv',
    ]);

    expect([...found.values()][0]?.seasonNumber).toBe(0);
  });
});
