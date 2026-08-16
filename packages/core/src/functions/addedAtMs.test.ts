import { describe, expect, it } from 'vitest';
import { addedAtMs } from './addedAtMs';

describe('addedAtMs', () => {
  it('reads a timestamp the server wrote', () => {
    expect(addedAtMs('2026-08-10T00:00:00.000Z')).toBe(Date.parse('2026-08-10T00:00:00.000Z'));
  });

  it('sorts a date it cannot read to the beginning rather than throwing', () => {
    expect(addedAtMs('whenever')).toBe(0);
  });
});
