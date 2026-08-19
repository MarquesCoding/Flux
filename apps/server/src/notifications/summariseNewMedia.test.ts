import { describe, expect, it } from 'vitest';
import { summariseNewMedia } from './summariseNewMedia';
import type { AddedItem } from './summariseNewMedia';

const film = (id: string, title: string): AddedItem => ({
  id,
  title,
  seriesId: null,
  seriesTitle: null,
});

const episode = (id: string, seriesId: string, seriesTitle: string): AddedItem => ({
  id,
  title: `${seriesTitle} episode`,
  seriesId,
  seriesTitle,
});

describe('summariseNewMedia', () => {
  it('says nothing about a window in which nothing arrived', () => {
    expect(summariseNewMedia([])).toBeNull();
  });

  it('collapses a whole series into one thing arriving', () => {
    const items = Array.from({ length: 12 }, (_unused, index) =>
      episode(`e${index.toString()}`, 'series-1', 'The Office'),
    );

    const summary = summariseNewMedia(items);

    expect(summary?.body).toContain('12 episodes');
    expect(summary?.body).toContain('The Office');
  });

  it('does not turn four hundred files into four hundred messages', () => {
    const items = Array.from({ length: 400 }, (_unused, index) =>
      episode(
        `e${index.toString()}`,
        `series-${(index % 5).toString()}`,
        `Programme ${(index % 5).toString()}`,
      ),
    );

    const summary = summariseNewMedia(items);

    expect(summary).not.toBeNull();
    expect(summary?.body).toContain('400 episodes');
  });

  it('names a few and counts the rest', () => {
    const items = [
      episode('a', 's1', 'The Office'),
      episode('b', 's2', 'Taskmaster'),
      episode('c', 's3', 'Poirot'),
      episode('d', 's4', 'Ghosts'),
      episode('e', 's5', 'Peep Show'),
    ];

    const summary = summariseNewMedia(items);

    expect(summary?.body).toContain('The Office, Taskmaster and Poirot');
    expect(summary?.body).toContain('2 more');
    expect(summary?.body).not.toContain('Peep Show');
  });

  it('counts films and episodes as the different things they are', () => {
    const summary = summariseNewMedia([film('f1', 'Heat'), episode('e1', 's1', 'The Office')]);

    expect(summary?.body).toContain('1 episode and 1 film');
  });

  it('speaks of one film in the singular', () => {
    const summary = summariseNewMedia([film('f1', 'Heat')]);

    expect(summary?.body).toContain('1 film');
    expect(summary?.body).toContain('Heat');
  });

  it('speaks of several films in the plural', () => {
    const summary = summariseNewMedia([film('f1', 'Heat'), film('f2', 'Sicario')]);

    expect(summary?.body).toContain('2 films');
    expect(summary?.body).toContain('Heat and Sicario');
  });

  it('points at the one film it is about', () => {
    expect(summariseNewMedia([film('f1', 'Heat')])?.link).toBe('/?inspecting=f1');
  });

  it('points at the one programme it is about', () => {
    const items = [episode('a', 's1', 'The Office'), episode('b', 's1', 'The Office')];

    expect(summariseNewMedia(items)?.link).toBe('/?show=s1');
  });

  it('points nowhere when it is about several things', () => {
    const items = [film('f1', 'Heat'), episode('e1', 's1', 'The Office')];

    expect(summariseNewMedia(items)?.link).toBeNull();
  });

  it('falls back to the episode title where a programme has no name', () => {
    const orphan: AddedItem = {
      id: 'e1',
      title: 'Unnamed episode',
      seriesId: 's1',
      seriesTitle: null,
    };

    expect(summariseNewMedia([orphan])?.body).toContain('Unnamed episode');
  });
});
