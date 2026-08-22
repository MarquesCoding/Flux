import { describe, expect, it } from 'vitest';
import { LASTS_FOR_MINUTES, hasExpired } from './hasExpired';

const now = new Date('2026-08-21T12:00:00.000Z');

const minutesAgo = (minutes: number): Date => new Date(now.getTime() - minutes * 60_000);

describe('hasExpired', () => {
  it('keeps a notice that has just arrived', () => {
    expect(hasExpired(minutesAgo(0), now)).toBe(false);
  });

  it('keeps one still within its time', () => {
    expect(hasExpired(minutesAgo(LASTS_FOR_MINUTES - 1), now)).toBe(false);
  });

  it('takes down one that has had its time', () => {
    expect(hasExpired(minutesAgo(LASTS_FOR_MINUTES + 1), now)).toBe(true);
  });

  it('reads a time written down as text, which is how they arrive', () => {
    expect(hasExpired(minutesAgo(LASTS_FOR_MINUTES + 1).toISOString(), now)).toBe(true);
  });

  it('keeps one whose time cannot be read, rather than throwing it away', () => {
    expect(hasExpired('not a time', now)).toBe(false);
  });
});
