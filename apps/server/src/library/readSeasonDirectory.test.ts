import { describe, expect, it } from 'vitest';
import { readSeasonDirectory } from './readSeasonDirectory';

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
