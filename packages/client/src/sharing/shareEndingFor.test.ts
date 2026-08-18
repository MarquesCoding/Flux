import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shareEndingFor } from './shareEndingFor';

const openShare = vi.hoisted(() => vi.fn());

vi.mock('@FluxClient/sharing/fetchShares', () => ({ openShare }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shareEndingFor', () => {
  it('says which of the three ways a link ended', async () => {
    openShare.mockResolvedValue({ kind: 'gone', reason: 'x', ended: 'spent' });

    await expect(shareEndingFor('a-token')).resolves.toBe('spent');
  });

  it('says nothing where the link still works, since the fault was something else', async () => {
    openShare.mockResolvedValue({ kind: 'opened', share: { kind: 'item', title: 'x', items: [] } });

    await expect(shareEndingFor('a-token')).resolves.toBeNull();
  });

  it('says nothing where the server could not be asked at all', async () => {
    openShare.mockResolvedValue({ kind: 'unknown' });

    await expect(shareEndingFor('a-token')).resolves.toBeNull();
  });
});
