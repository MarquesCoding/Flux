import { describe, expect, it } from 'vitest';
import { fixturesDirectory } from './fixturesDirectory';

describe('fixturesDirectory', () => {
  it('keeps the corpus out of the working tree by default', () => {
    expect(fixturesDirectory({ configured: undefined, home: '/home/dan' })).toBe(
      '/home/dan/.cache/valence-fixtures',
    );
  });

  it('honours an explicit location', () => {
    expect(fixturesDirectory({ configured: '/mnt/corpus', home: '/home/dan' })).toBe('/mnt/corpus');
  });

  it('treats a blank setting as no setting', () => {
    expect(fixturesDirectory({ configured: '   ', home: '/home/dan' })).toBe(
      '/home/dan/.cache/valence-fixtures',
    );
  });
});
