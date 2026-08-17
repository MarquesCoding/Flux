import { describe, expect, it } from 'vitest';
import { NewShareSchema, isShareLive, shareReaches, whyShareEnded } from './Share';
import type { ShareStanding } from './Share';

const NOW = new Date('2026-08-16T12:00:00.000Z');

const standing = (over: Partial<ShareStanding> = {}): ShareStanding => ({
  expiresAt: null,
  viewCap: null,
  views: 0,
  revokedAt: null,
  ...over,
});

describe('isShareLive', () => {
  it('works when nothing was asked to end it', () => {
    expect(isShareLive(standing(), NOW)).toBe(true);
  });

  it('stops the moment it is revoked', () => {
    expect(isShareLive(standing({ revokedAt: new Date('2026-08-16T11:00:00.000Z') }), NOW)).toBe(
      false,
    );
  });

  it('stops even when revoked a moment ago and nothing else has run out', () => {
    expect(isShareLive(standing({ revokedAt: NOW, viewCap: 100, views: 0 }), NOW)).toBe(false);
  });

  it('works right up to the moment it expires', () => {
    expect(isShareLive(standing({ expiresAt: new Date('2026-08-16T12:00:01.000Z') }), NOW)).toBe(
      true,
    );
  });

  it('stops at the moment it expires, rather than a moment after', () => {
    expect(isShareLive(standing({ expiresAt: NOW }), NOW)).toBe(false);
  });

  it('stops once expired', () => {
    expect(isShareLive(standing({ expiresAt: new Date('2026-08-16T11:59:59.000Z') }), NOW)).toBe(
      false,
    );
  });

  it('works while there are views left', () => {
    expect(isShareLive(standing({ viewCap: 3, views: 2 }), NOW)).toBe(true);
  });

  it('stops once the views are spent', () => {
    expect(isShareLive(standing({ viewCap: 3, views: 3 }), NOW)).toBe(false);
  });

  it('stops when either runs out, whichever comes first', () => {
    const spent = standing({ viewCap: 1, views: 1, expiresAt: new Date('2027-01-01T00:00:00Z') });
    const stale = standing({ viewCap: 100, views: 0, expiresAt: new Date('2020-01-01T00:00:00Z') });

    expect(isShareLive(spent, NOW)).toBe(false);
    expect(isShareLive(stale, NOW)).toBe(false);
  });
});

describe('whyShareEnded', () => {
  it('says nothing while the link still works', () => {
    expect(whyShareEnded(standing(), NOW)).toBeNull();
  });

  it('says it was withdrawn before it says anything else', () => {
    const both = standing({ revokedAt: NOW, expiresAt: new Date('2020-01-01T00:00:00Z') });

    expect(whyShareEnded(both, NOW)).toBe('This link was withdrawn.');
  });

  it('says it expired', () => {
    expect(whyShareEnded(standing({ expiresAt: new Date('2020-01-01T00:00:00Z') }), NOW)).toBe(
      'This link has expired.',
    );
  });

  it('says it was opened as often as it was meant to be', () => {
    expect(whyShareEnded(standing({ viewCap: 1, views: 1 }), NOW)).toContain('as many times');
  });
});

describe('shareReaches', () => {
  const item = { id: 'film-1', seriesId: null };
  const episode = { id: 'ep-1', seriesId: 'show-1' };

  it('reaches the one item it was made for', () => {
    expect(shareReaches({ kind: 'item', mediaId: 'film-1', seriesId: null }, item)).toBe(true);
  });

  it('reaches nothing else, whatever else exists', () => {
    expect(shareReaches({ kind: 'item', mediaId: 'film-1', seriesId: null }, episode)).toBe(false);
  });

  it('reaches every episode of the series it was made for', () => {
    expect(shareReaches({ kind: 'series', mediaId: null, seriesId: 'show-1' }, episode)).toBe(true);
  });

  it('does not reach an episode of a different series', () => {
    expect(
      shareReaches(
        { kind: 'series', mediaId: null, seriesId: 'show-1' },
        {
          id: 'ep-9',
          seriesId: 'show-2',
        },
      ),
    ).toBe(false);
  });

  it('does not reach a film from a series share', () => {
    expect(shareReaches({ kind: 'series', mediaId: null, seriesId: 'show-1' }, item)).toBe(false);
  });

  it('does not reach an item whose series is unknown from a series share', () => {
    expect(
      shareReaches({ kind: 'series', mediaId: null, seriesId: null }, { id: 'x', seriesId: null }),
    ).toBe(false);
  });
});

describe('NewShareSchema', () => {
  it('takes an item share naming an item', () => {
    expect(() =>
      NewShareSchema.parse({ kind: 'item', mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9' }),
    ).not.toThrow();
  });

  it('refuses an item share naming no item', () => {
    expect(() => NewShareSchema.parse({ kind: 'item' })).toThrow();
  });

  it('refuses a series share naming no series', () => {
    expect(() => NewShareSchema.parse({ kind: 'series' })).toThrow();
  });

  it('refuses a view cap of nothing', () => {
    expect(() =>
      NewShareSchema.parse({
        kind: 'item',
        mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
        viewCap: 0,
      }),
    ).toThrow();
  });
});
