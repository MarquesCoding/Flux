import { describe, expect, it } from 'vitest';
import { isMediaFile, readTitleFromPath } from './readTitleFromPath';

describe('isMediaFile', () => {
  it('accepts the containers Valence plays', () => {
    expect(isMediaFile('film.mkv')).toBe(true);
    expect(isMediaFile('film.mp4')).toBe(true);
    expect(isMediaFile('recording.ts')).toBe(true);
  });

  it('is case insensitive about the extension', () => {
    expect(isMediaFile('FILM.MKV')).toBe(true);
  });

  it('rejects the clutter that sits beside media', () => {
    expect(isMediaFile('poster.jpg')).toBe(false);
    expect(isMediaFile('film.nfo')).toBe(false);
    expect(isMediaFile('film.srt')).toBe(false);
    expect(isMediaFile('notes.txt')).toBe(false);
  });

  it('rejects hidden files', () => {
    expect(isMediaFile('.hidden.mkv')).toBe(false);
    expect(isMediaFile('._resource.mp4')).toBe(false);
  });

  it('rejects a file with no extension', () => {
    expect(isMediaFile('README')).toBe(false);
  });
});

describe('readTitleFromPath', () => {
  it('reads a plain title', () => {
    expect(readTitleFromPath('/media/films/Arrival.mkv')).toEqual({
      title: 'Arrival',
      year: null,
    });
  });

  it('reads a title and year', () => {
    expect(readTitleFromPath('/media/films/Arrival (2016).mkv')).toEqual({
      title: 'Arrival',
      year: 2016,
    });
  });

  it('reads a dotted release name', () => {
    expect(readTitleFromPath('Blade.Runner.2049.2017.2160p.UHD.BluRay.x265.mkv')).toEqual({
      title: 'Blade Runner 2049',
      year: 2017,
    });
  });

  it('drops quality and codec noise', () => {
    expect(readTitleFromPath('Dune Part Two 2024 1080p WEBRip x264 DTS.mkv').title).toBe(
      'Dune Part Two',
    );
  });

  it('handles bracketed tags', () => {
    expect(readTitleFromPath('[Group] Akira (1988) [1080p].mkv')).toEqual({
      title: 'Group Akira',
      year: 1988,
    });
  });

  it('keeps a number that is part of the title', () => {
    expect(readTitleFromPath('Blade Runner 2049 (2017).mkv').title).toBe('Blade Runner 2049');
  });

  it('ignores a year that is not plausible', () => {
    expect(readTitleFromPath('Film 1234.mkv').year).toBeNull();
  });

  it('falls back to the filename when nothing survives', () => {
    expect(readTitleFromPath('1080p.mkv').title).toBe('1080p');
  });

  it('uses only the final path segment', () => {
    expect(readTitleFromPath('/media/2019/films/Parasite (2019).mkv').title).toBe('Parasite');
  });
});

describe('a name with no extension to drop', () => {
  it('keeps the whole name where there is no dot in it', () => {
    expect(readTitleFromPath('/media/Arrival').title).toBe('Arrival');
  });

  it('leaves a leading dot alone rather than emptying the name', () => {
    expect(readTitleFromPath('/media/.Arrival').title).not.toBe('');
  });
});

describe('a file with no extension at all', () => {
  it('is not something to play', () => {
    expect(isMediaFile('Arrival')).toBe(false);
  });
});

describe('a film in a folder of its own', () => {
  it('takes the name and year from the folder when the file carries neither', () => {
    expect(readTitleFromPath('/media/films/Arrival (2016)/movie.mkv')).toEqual({
      title: 'Arrival',
      year: 2016,
    });
  });

  it('reads a disc rip that kept the name its ripper gave it', () => {
    expect(readTitleFromPath('/media/films/Parasite (2019)/title00.mkv')).toEqual({
      title: 'Parasite',
      year: 2019,
    });
  });

  it('believes the folder over a file that disagrees with it, since somebody named the folder', () => {
    expect(readTitleFromPath('/media/films/The Thing (1982)/The.Thing.2011.1080p.mkv')).toEqual({
      title: 'The Thing',
      year: 1982,
    });
  });

  it('leaves a film loose among others alone, since that folder names no film', () => {
    expect(readTitleFromPath('/media/films/Arrival (2016).mkv')).toEqual({
      title: 'Arrival',
      year: 2016,
    });
  });

  it('leaves a folder that names a year and no film alone', () => {
    expect(readTitleFromPath('/media/films/2019/Parasite.mkv')).toEqual({
      title: 'Parasite',
      year: null,
    });
  });

  it('does not read a season folder as a film, since that is a programme', () => {
    expect(readTitleFromPath('/media/tv/Some Show/Season 1/s01e02.mkv').title).toBe('s01e02');
  });

  it('does not read a specials folder as a film either', () => {
    expect(readTitleFromPath('/media/tv/Some Show/Specials/s00e01.mkv').title).toBe('s00e01');
  });
});
