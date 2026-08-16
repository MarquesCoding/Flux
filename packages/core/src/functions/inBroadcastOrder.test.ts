import { describe, expect, it } from 'vitest';
import { inBroadcastOrder } from './inBroadcastOrder';

const episode = (seasonNumber: number, episodeNumber: number, title = 'Untitled') => ({
  title,
  seasonNumber,
  episodeNumber,
});

describe('inBroadcastOrder', () => {
  it('puts an earlier season first', () => {
    expect(inBroadcastOrder(episode(1, 9), episode(2, 1))).toBeLessThan(0);
  });

  it('puts an earlier episode of the same season first', () => {
    expect(inBroadcastOrder(episode(1, 2), episode(1, 3))).toBeLessThan(0);
  });

  it('falls back to the title when two episodes are numbered the same', () => {
    expect(inBroadcastOrder(episode(1, 1, 'Arrival'), episode(1, 1, 'Belfast'))).toBeLessThan(0);
  });

  it('treats an unnumbered episode as the beginning, rather than dropping it', () => {
    expect(inBroadcastOrder({ title: 'Pilot' }, episode(1, 2))).toBeLessThan(0);
  });
});
