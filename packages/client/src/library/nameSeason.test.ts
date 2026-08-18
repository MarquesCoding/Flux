import { describe, expect, it } from 'vitest';
import { nameSeason } from './nameSeason';

describe('nameSeason', () => {
  it('names a season by its number', () => {
    expect(nameSeason(1)).toBe('Season 1');
    expect(nameSeason(12)).toBe('Season 12');
  });

  it('calls season zero specials, which is what it is', () => {
    expect(nameSeason(0)).toBe('Specials');
  });

  it('calls episodes with no season specials rather than nothing at all', () => {
    expect(nameSeason(null)).toBe('Specials');
  });
});
