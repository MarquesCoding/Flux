import { describe, expect, it } from 'vitest';
import { inSeasonOrder } from './inSeasonOrder';

describe('inSeasonOrder', () => {
  it('puts an earlier season first', () => {
    expect(inSeasonOrder(1, 2)).toBeLessThan(0);
    expect(inSeasonOrder(10, 2)).toBeGreaterThan(0);
  });

  it('puts the specials after every season, which is when they are watched', () => {
    expect(inSeasonOrder(0, 1)).toBeGreaterThan(0);
    expect(inSeasonOrder(0, 12)).toBeGreaterThan(0);
  });

  it('puts what nobody could place after even the specials', () => {
    expect(inSeasonOrder(null, 0)).toBeGreaterThan(0);
    expect(inSeasonOrder(null, 1)).toBeGreaterThan(0);
  });

  it('leaves two of the same kind where they were', () => {
    expect(inSeasonOrder(2, 2)).toBe(0);
    expect(inSeasonOrder(0, 0)).toBe(0);
    expect(inSeasonOrder(null, null)).toBe(0);
  });

  it('sorts a whole programme the way it is watched', () => {
    expect([null, 0, 2, 1].sort(inSeasonOrder)).toEqual([1, 2, 0, null]);
  });
});
