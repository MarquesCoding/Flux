import { describe, expect, it } from 'vitest';
import { toIso } from './toIso';

describe('toIso', () => {
  it('writes a timestamp the way the API does', () => {
    expect(toIso(new Date('2026-08-14T20:00:00.000Z'))).toBe('2026-08-14T20:00:00.000Z');
  });

  it('keeps an absent timestamp absent rather than inventing one', () => {
    expect(toIso(null)).toBeNull();
  });

  it('answers in UTC whatever the server is set to', () => {
    expect(toIso(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
  });
});
