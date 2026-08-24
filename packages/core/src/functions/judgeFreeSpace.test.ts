import { describe, expect, it } from 'vitest';
import { judgeFreeSpace } from './judgeFreeSpace';

describe('judgeFreeSpace', () => {
  it('says a small download on a roomy device fits', () => {
    expect(judgeFreeSpace({ bytes: 4_000_000_000, freeBytes: 200_000_000_000 })).toBe('fits');
  });

  it('calls it tight when it would take most of what is left', () => {
    expect(judgeFreeSpace({ bytes: 30_000_000_000, freeBytes: 41_000_000_000 })).toBe('tight');
  });

  it('says plainly when it will not fit at all, rather than failing part way through', () => {
    expect(judgeFreeSpace({ bytes: 58_000_000_000, freeBytes: 41_000_000_000 })).toBe('willNotFit');
  });

  it('claims nothing where the device would not say how much room it has', () => {
    expect(judgeFreeSpace({ bytes: 4_000_000_000, freeBytes: null })).toBe('unknown');
  });

  it('claims nothing where the size is not known either', () => {
    expect(judgeFreeSpace({ bytes: null, freeBytes: 200_000_000_000 })).toBe('unknown');
  });
});
