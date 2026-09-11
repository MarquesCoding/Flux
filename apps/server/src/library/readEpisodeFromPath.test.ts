import { describe, expect, it } from 'vitest';
import { readEpisodeFromPath, isSameSeason } from './readEpisodeFromPath';

describe('readEpisodeFromPath', () => {
  it('reads the usual numbering', () => {
    expect(readEpisodeFromPath('/media/Some Show/Season 1/Some.Show.S01E02.1080p.mkv')).toEqual({
      seriesTitle: 'Some Show',
      seriesYear: null,
      seriesFolder: '/media/Some Show',
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
      seriesFolder: null,
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

describe('a filename that names the year beside the series', () => {
  it('leaves the year out of the series title, where it would search for a show nobody made', () => {
    const read = readEpisodeFromPath(
      "/media/From (2022) Season 1 S01/From (2022) - S01E01 - Long Day's Journey Into Night (1080p AMZN WEB-DL x265).mkv",
    );

    expect(read.seriesTitle).toBe('From');
  });

  it('keeps the year, which is what tells two shows of the same name apart', () => {
    const read = readEpisodeFromPath(
      '/media/Shows/From (2022) - S01E02 - The Way Things Are Now (1080p).mkv',
    );

    expect(read.seriesYear).toBe(2022);
  });

  it('still reads the episode either way', () => {
    const read = readEpisodeFromPath('/media/From (2022) - S01E03 - Choosing Day (1080p).mkv');

    expect(read.seasonNumber).toBe(1);
    expect(read.episodeNumber).toBe(3);
    expect(read.episodeTitle).toBe('Choosing Day');
  });

  it('names the folder that separates one programme from another', () => {
    expect(
      readEpisodeFromPath('/media/The Office (US)/Season 1/The Office - S01E01.mkv').seriesFolder,
    ).toBe('/media/The Office (US)');
  });

  it('climbs past a season folder, which names a season rather than a programme', () => {
    const inSeason = readEpisodeFromPath('/media/Show/Season 2/Show - S02E01.mkv').seriesFolder;
    const beside = readEpisodeFromPath('/media/Show/Show - S01E01.mkv').seriesFolder;

    expect(inSeason).toBe('/media/Show');
    expect(beside).toBe('/media/Show');
  });

  it('gives two same-named programmes two different folders', () => {
    const uk = readEpisodeFromPath('/media/UK/The Office/The Office - S01E01.mkv').seriesFolder;
    const us = readEpisodeFromPath('/media/US/The Office/The Office - S01E01.mkv').seriesFolder;

    expect(uk).not.toBe(us);
  });

  it('has no folder to offer for a film', () => {
    expect(readEpisodeFromPath('/media/Arrival 2016 1080p.mkv').seriesFolder).toBeNull();
  });

  it('has none for a loose episode with nothing above it', () => {
    expect(readEpisodeFromPath('Show - S01E01.mkv').seriesFolder).toBeNull();
  });
});
