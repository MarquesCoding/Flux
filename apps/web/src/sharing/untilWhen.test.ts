import { describe, expect, it } from 'vitest';
import { untilWhen } from './untilWhen';
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

describe('untilWhen', () => {
  it('says when a link with an end date runs out', () => {
    expect(untilWhen(share({ expiresAt: '2099-03-04T15:30:00.000Z' }))).toMatch(/^Runs out .*2099/);
  });

  it('says a link with nothing to end it lasts until it is withdrawn', () => {
    expect(untilWhen(share())).toBe('Until it is withdrawn');
  });

  it('says an allowance is what will end a link that has one and no date', () => {
    expect(untilWhen(share({ viewCap: 3 }))).toBe('Until it has been opened enough times');
  });
});
