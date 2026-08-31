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

  it('does not call an episode nobody could place a special, which is a different thing', () => {
    expect(nameSeason(null)).toBe('Other');
  });
});
