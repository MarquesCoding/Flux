import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reasonIfShareEnded } from './reasonIfShareEnded';

const openShare = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/sharing/fetchShares', () => ({ openShare }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reasonIfShareEnded', () => {
  it('says why a link stopped working, in the server’s own words', async () => {
    openShare.mockResolvedValue({ kind: 'gone', reason: 'This link was withdrawn.' });

    await expect(reasonIfShareEnded('a-token')).resolves.toBe('This link was withdrawn.');
  });

  it('says nothing where the link still works, since the fault was something else', async () => {
    openShare.mockResolvedValue({ kind: 'opened', share: { kind: 'item', title: 'x', items: [] } });

    await expect(reasonIfShareEnded('a-token')).resolves.toBeNull();
  });

  it('says nothing where the server could not be asked at all', async () => {
    openShare.mockResolvedValue({ kind: 'unknown' });

    await expect(reasonIfShareEnded('a-token')).resolves.toBeNull();
  });
});
