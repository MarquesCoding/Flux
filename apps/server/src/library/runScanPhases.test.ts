import { describe, expect, it, vi } from 'vitest';
import { runScanPhases } from './runScanPhases';
import type { Mock } from 'vitest';
import type { ScanResult } from '@ValenceContracts/schemas/Library';

type SpyingWork = {
  scan: Mock<() => Promise<ScanResult | null>>;
  fetchLogos: Mock<() => Promise<void>>;
  regeneratePreviews: Mock<() => Promise<void>>;
  regenerateTrickplay: Mock<() => Promise<void>>;
  detectSegments: Mock<() => Promise<void>>;
};

const NOTHING_CHANGED: ScanResult = { added: 0, updated: 0, removed: 0, failed: 0 };

/**
 * A set of phases that record the order they ran in, so a test can say what a scan actually does
 * rather than what it was written to do.
 */
const spying = (ran: string[]): SpyingWork => ({
  scan: vi.fn((): Promise<ScanResult | null> => {
    ran.push('scan');

    return Promise.resolve(NOTHING_CHANGED);
  }),
  fetchLogos: vi.fn(() => {
    ran.push('fetchLogos');

    return Promise.resolve();
  }),
  regeneratePreviews: vi.fn(() => {
    ran.push('regeneratePreviews');

    return Promise.resolve();
  }),
  regenerateTrickplay: vi.fn(() => {
    ran.push('regenerateTrickplay');

    return Promise.resolve();
  }),
  detectSegments: vi.fn(() => {
    ran.push('detectSegments');

    return Promise.resolve();
  }),
});

describe('runScanPhases', () => {
  it('makes everything an item is missing, lettering included', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
    });

    expect(ran).toEqual([
      'scan',
      'fetchLogos',
      'regeneratePreviews',
      'detectSegments',
      'regenerateTrickplay',
    ]);
  });

  it('fetches lettering, which is the phase a scan used to leave out', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
    });

    expect(ran).toContain('fetchLogos');
  });

  it('fetches lettering before the renders, since it is cheap and a scan is watched', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
    });

    expect(ran.indexOf('fetchLogos')).toBeLessThan(ran.indexOf('regeneratePreviews'));
  });

  it('reports what the reading phase changed', async () => {
    const onScanned = vi.fn(() => Promise.resolve());
    const work = spying([]);

    work.scan.mockResolvedValue({ added: 3, updated: 1, removed: 0, failed: 0 });

    await runScanPhases({ work, isCancelled: () => false, onScanned });

    expect(onScanned).toHaveBeenCalledWith({ added: 3, updated: 1, removed: 0, failed: 0 });
  });

  it('says nothing about a reading phase that reported nothing', async () => {
    const onScanned = vi.fn(() => Promise.resolve());
    const work = spying([]);

    work.scan.mockResolvedValue(null);

    await runScanPhases({ work, isCancelled: () => false, onScanned });

    expect(onScanned).not.toHaveBeenCalled();
  });

  it('still makes what is missing when the reading phase reported nothing', async () => {
    const ran: string[] = [];
    const work = spying(ran);

    work.scan.mockImplementation(() => {
      ran.push('scan');

      return Promise.resolve(null);
    });

    await runScanPhases({
      work,
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
    });

    expect(ran).toContain('fetchLogos');
  });

  it('does nothing at all once cancelled', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => true,
      onScanned: () => Promise.resolve(),
    });

    expect(ran).toEqual([]);
  });

  it('stops at the next phase boundary when cancelled part-way', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => ran.length >= 2,
      onScanned: () => Promise.resolve(),
    });

    expect(ran).toEqual(['scan', 'fetchLogos']);
  });

  it('finds the intros before it spends a minute a film drawing thumbnails', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
    });

    expect(ran.indexOf('detectSegments')).toBeLessThan(ran.indexOf('regenerateTrickplay'));
  });
});
