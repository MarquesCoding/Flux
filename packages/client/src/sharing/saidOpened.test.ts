import { describe, expect, it } from 'vitest';
import { saidOpened } from './saidOpened';
import type { Share } from '@FluxContracts/schemas/Share';

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

describe('saidOpened', () => {
  it('counts one opening as a time rather than as times', () => {
    expect(saidOpened(share({ views: 1 }))).toBe('1 time');
  });

  it('counts none and many as times', () => {
    expect(saidOpened(share({ views: 0 }))).toBe('0 times');
    expect(saidOpened(share({ views: 3 }))).toBe('3 times');
  });

  it('says how far through an allowance a link is', () => {
    expect(saidOpened(share({ views: 2, viewCap: 5 }))).toBe('2 of 5 times');
  });

  it('follows the allowance for the plural, since that is what the word counts', () => {
    expect(saidOpened(share({ views: 0, viewCap: 1 }))).toBe('0 of 1 time');
    expect(saidOpened(share({ views: 1, viewCap: 1 }))).toBe('1 of 1 time');
  });
});
