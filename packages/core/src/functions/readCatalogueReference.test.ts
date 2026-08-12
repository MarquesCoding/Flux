import { describe, expect, it } from 'vitest';
import { readCatalogueReference } from './readCatalogueReference';

describe('readCatalogueReference', () => {
  it('reads a series from the address somebody copied', () => {
    expect(readCatalogueReference('https://www.themoviedb.org/tv/97546-ted-lasso')).toEqual({
      id: '97546',
      kind: 'tv',
    });
  });

  it('reads a film from the address somebody copied', () => {
    expect(readCatalogueReference('https://www.themoviedb.org/movie/315162-puss-in-boots')).toEqual(
      { id: '315162', kind: 'movie' },
    );
  });

  it('reads an address with no title after the id', () => {
    expect(readCatalogueReference('themoviedb.org/tv/230059')).toEqual({
      id: '230059',
      kind: 'tv',
    });
  });

  it('reads a bare number, without claiming to know which catalogue it is', () => {
    expect(readCatalogueReference('97546')).toEqual({ id: '97546', kind: null });
  });

  it('ignores the space somebody pasted with it', () => {
    expect(readCatalogueReference('  97546 ')).toEqual({ id: '97546', kind: null });
  });

  it('reads nothing from an address with no id in it', () => {
    expect(readCatalogueReference('https://www.themoviedb.org/tv')).toBeNull();
  });

  it('reads nothing from words', () => {
    expect(readCatalogueReference('ted lasso')).toBeNull();
  });

  it('reads nothing from nothing', () => {
    expect(readCatalogueReference('')).toBeNull();
    expect(readCatalogueReference('   ')).toBeNull();
  });

  it('does not take a number out of the middle of a title', () => {
    expect(readCatalogueReference('blade runner 2049')).toBeNull();
  });

  it('reads the language-prefixed address the site sometimes gives', () => {
    expect(
      readCatalogueReference('https://www.themoviedb.org/tv/97546-ted-lasso?language=en'),
    ).toEqual({ id: '97546', kind: 'tv' });
  });
});
