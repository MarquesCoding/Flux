import { describe, expect, it } from 'vitest';
import { groupExtras } from './groupExtras';

const FILM = '/media/films/Arrival (2016)/Arrival (2016).mkv';

describe('a film keeping its extras beside it', () => {
  it('hangs a folder of them off the film in the folder above', () => {
    const found = groupExtras([FILM, '/media/films/Arrival (2016)/Featurettes/Scoring.mkv']);

    expect(found.get('/media/films/Arrival (2016)/Featurettes/Scoring.mkv')).toEqual({
      kind: 'featurette',
      parentPath: FILM,
      seriesFolder: null,
    });
  });

  it('reads the kind from what the folder is called', () => {
    const found = groupExtras([
      FILM,
      '/media/films/Arrival (2016)/Behind The Scenes/A talk.mkv',
      '/media/films/Arrival (2016)/Deleted Scenes/Cut.mkv',
    ]);

    expect(found.get('/media/films/Arrival (2016)/Behind The Scenes/A talk.mkv')?.kind).toBe(
      'behindTheScenes',
    );
    expect(found.get('/media/films/Arrival (2016)/Deleted Scenes/Cut.mkv')?.kind).toBe(
      'deletedScene',
    );
  });

  it('hangs one marked by its own name off the film it is named after', () => {
    const found = groupExtras([FILM, '/media/films/Arrival (2016)/Arrival (2016)-trailer.mkv']);

    expect(found.get('/media/films/Arrival (2016)/Arrival (2016)-trailer.mkv')).toEqual({
      kind: 'trailer',
      parentPath: FILM,
      seriesFolder: null,
    });
  });

  it('accepts the several ways a suffix is written', () => {
    const found = groupExtras([
      FILM,
      '/media/films/Arrival (2016)/Arrival (2016).sample.mkv',
      '/media/films/Arrival (2016)/Arrival (2016)_interview.mkv',
      '/media/films/Arrival (2016)/Arrival (2016) short.mkv',
    ]);

    expect([...found.values()].map((one) => one.kind).sort()).toEqual([
      'interview',
      'sample',
      'short',
    ]);
  });

  it('leaves the film itself alone', () => {
    expect(groupExtras([FILM]).has(FILM)).toBe(false);
  });

  it('does not read a film whose name merely ends in a word as an extra of nothing', () => {
    expect(groupExtras(['/media/films/The Short.mkv']).size).toBe(0);
  });
});

describe('a programme keeping its extras above its seasons', () => {
  const EPISODE = '/media/tv/Some Show/Season 1/Some.Show.S01E01.mkv';

  it('belongs to the programme rather than to any one episode of it', () => {
    const found = groupExtras([EPISODE, '/media/tv/Some Show/Extras/Making Of.mkv']);

    expect(found.get('/media/tv/Some Show/Extras/Making Of.mkv')).toEqual({
      kind: 'other',
      parentPath: null,
      seriesFolder: '/media/tv/Some Show',
    });
  });

  it('is still an extra where the programme holds nothing else at all', () => {
    const found = groupExtras(['/media/tv/Some Show/Extras/Making Of.mkv']);

    expect(found.get('/media/tv/Some Show/Extras/Making Of.mkv')?.kind).toBe('other');
  });
});

describe('an extra with nothing to belong to', () => {
  it('is still known for what it is, and hangs off nothing', () => {
    const found = groupExtras(['/media/Trailers/Something.mkv']);

    expect(found.get('/media/Trailers/Something.mkv')).toMatchObject({
      kind: 'trailer',
      parentPath: null,
    });
  });
});
