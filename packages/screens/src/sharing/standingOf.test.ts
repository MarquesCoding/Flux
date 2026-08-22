import { describe, expect, it } from 'vitest';
import { standingOf } from './standingOf';
import type { Share } from '@ValenceContracts/schemas/Share';

const NOW = Date.parse('2026-08-18T00:00:00.000Z');

const share = (overrides: Partial<Share> = {}): Share => ({
  id: 'share-1',
  kind: 'item',
  mediaId: 'media-1',
  seriesId: null,
  title: 'The Thing',
  createdAt: '2026-08-10T09:00:00.000Z',
  expiresAt: null,
  viewCap: null,
  views: 0,
  isRevoked: false,
  isSpent: false,
  ...overrides,
});

describe('standingOf', () => {
  it('says a working link is live, and says so loudly enough to be found', () => {
    expect(standingOf(share(), NOW)).toEqual({ label: 'Live', tone: 'accent' });
  });

  it('says a withdrawn link was withdrawn rather than that it is merely finished', () => {
    expect(standingOf(share({ isRevoked: true, isSpent: true }), NOW).label).toBe('Withdrawn');
  });

  it('tells a link that ran out apart from one that was used up', () => {
    const expired = share({ expiresAt: '2020-01-01T00:00:00.000Z', isSpent: true });
    const spent = share({ viewCap: 2, views: 2, isSpent: true });

    expect(standingOf(expired, NOW).label).toBe('Ran out');
    expect(standingOf(spent, NOW).label).toBe('All used up');
  });

  it('calls a link with an end date still ahead of it live', () => {
    expect(standingOf(share({ expiresAt: '2099-01-01T00:00:00.000Z' }), NOW).label).toBe('Live');
  });
});
