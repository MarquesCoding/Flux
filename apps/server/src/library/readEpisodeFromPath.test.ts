import { describe, expect, it } from 'vitest';
import { readEpisodeFromPath, readSeasonDirectory, isSameSeason } from './readEpisodeFromPath';

describe('readSeasonDirectory', () => {
  it('reads a season written out', () => {
    expect(readSeasonDirectory('Season 2')).toBe(2);
  });

  it('reads a season written short', () => {
    expect(readSeasonDirectory('S03')).toBe(3);
  });

  it('treats specials as season zero, which is where they belong', () => {
    expect(readSeasonDirectory('Specials')).toBe(0);
  });

  it('reports nothing for a directory that is not a season', () => {
    expect(readSeasonDirectory('Some Show')).toBeNull();
  });
});

describe('readEpisodeFromPath', () => {
  it('reads the usual numbering', () => {
    expect(readEpisodeFromPath('/media/Some Show/Season 1/Some.Show.S01E02.1080p.mkv')).toEqual({
      seriesTitle: 'Some Show',
      seriesYear: null,
      seasonNumber: 1,
      episodeNumber: 2,
      episodeTitle: null,
    });
  });

  it('reads the cross form', () => {
    expect(readEpisodeFromPath('/media/Some Show/Season 1/Some Show - 1x03.mkv')).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 3,
    });
  });

  it('reads the spelled out form', () => {
    expect(
      readEpisodeFromPath('/media/Some Show/Season 2/Season 2 Episode 5 - Title.mkv'),
    ).toMatchObject({ seasonNumber: 2, episodeNumber: 5 });
  });

  it('takes the series name from the filename, ahead of the folder above it', () => {
    expect(
      readEpisodeFromPath('/media/tv/Another Show (2019)/Season 3/Another.Show.s03e07.mkv')
        .seriesTitle,
    ).toBe('Another Show');
  });

  it('falls back to the folder above the season for a file that names nothing', () => {
    const found = readEpisodeFromPath('/media/tv/Another Show (2019)/Season 3/s03e07.mkv');

    expect(found.seriesTitle).toBe('Another Show');
  });

  it('reads the year a folder names alongside a show, and keeps it out of the title', () => {
    const found = readEpisodeFromPath('/media/tv/Ted (2024)/Season 1/s01e01.mkv');

    expect(found.seriesTitle).toBe('Ted');
    expect(found.seriesYear).toBe(2024);
  });

  it('reports no series year when the folder does not name one', () => {
    expect(
      readEpisodeFromPath('/media/Some Show/Season 1/Some.Show.S01E02.mkv').seriesYear,
    ).toBeNull();
  });

  it('falls back to the immediate folder when episodes are not in season folders', () => {
    expect(readEpisodeFromPath('/media/tv/Flat Show/Flat.Show.S01E01.mkv')).toMatchObject({
      seriesTitle: 'Flat Show',
      seasonNumber: 1,
      episodeNumber: 1,
    });
  });

  it('trusts the filename over the directory when they disagree', () => {
    expect(readEpisodeFromPath('/media/Some Show/Season 1/Some.Show.S02E04.mkv').seasonNumber).toBe(
      2,
    );
  });

  it('reads an episode from a season directory when the filename only numbers it', () => {
    expect(readEpisodeFromPath('/media/Some Show/Season 4/Some Show 4x11.mkv')).toMatchObject({
      seasonNumber: 4,
      episodeNumber: 11,
    });
  });

  it('refuses to guess for a film', () => {
    expect(readEpisodeFromPath('/media/films/Arrival (2016).mkv')).toEqual({
      seriesTitle: null,
      seriesYear: null,
      seasonNumber: null,
      episodeNumber: null,
      episodeTitle: null,
    });
  });

  it('does not read a resolution as an episode number', () => {
    expect(readEpisodeFromPath('/media/films/Some Film 1080p x265.mkv').episodeNumber).toBeNull();
  });

  it('does not read a year as an episode number', () => {
    expect(
      readEpisodeFromPath('/media/films/Blade Runner 2049 (2017).mkv').episodeNumber,
    ).toBeNull();
  });
});

describe('isSameSeason', () => {
  const first = readEpisodeFromPath('/media/Some Show/Season 1/Some.Show.S01E01.mkv');
  const second = readEpisodeFromPath('/media/Some Show/Season 1/Some.Show.S01E02.mkv');

  it('groups two episodes of one season', () => {
    expect(isSameSeason(first, second)).toBe(true);
  });

  it('keeps seasons apart, because a theme tune can change between them', () => {
    const laterSeason = readEpisodeFromPath('/media/Some Show/Season 2/Some.Show.S02E01.mkv');

    expect(isSameSeason(first, laterSeason)).toBe(false);
  });

  it('keeps shows apart', () => {
    const otherShow = readEpisodeFromPath('/media/Other Show/Season 1/Other.Show.S01E01.mkv');

    expect(isSameSeason(first, otherShow)).toBe(false);
  });

  it('groups nothing when the path said nothing', () => {
    const film = readEpisodeFromPath('/media/films/Arrival (2016).mkv');

    expect(isSameSeason(film, film)).toBe(false);
  });

  it('ignores case in the series name, since releases disagree on it', () => {
    const shouty = readEpisodeFromPath('/media/SOME SHOW/Season 1/SOME.SHOW.S01E09.mkv');

    expect(isSameSeason(first, shouty)).toBe(true);
  });
});
