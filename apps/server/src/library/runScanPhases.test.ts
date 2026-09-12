import { describe, expect, it, vi } from 'vitest';
import { runScanPhases } from './runScanPhases';
import type { Mock } from 'vitest';
import type { ScanResult } from '@ValenceContracts/schemas/Library';

type SpyingWork = {
  scan: Mock<() => Promise<ScanResult | null>>;
  fetchLogos: Mock<() => Promise<void>>;
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
  detectSegments: vi.fn(() => {
    ran.push('detectSegments');

    return Promise.resolve();
  }),
});

describe('runScanPhases', () => {
  it('reads the library, letters it, and finds the intros', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
      onRead: () => Promise.resolve(),
    });

    expect(ran).toEqual(['scan', 'fetchLogos', 'detectSegments']);
  });

  it('draws nothing itself, which is what a scan waited days for', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
      onRead: () => Promise.resolve(),
    });

    expect(ran).not.toContain('regeneratePreviews');
    expect(ran).not.toContain('regenerateTrickplay');
  });

  it('asks for the renders once the reading is done, rather than doing them', async () => {
    const ran: string[] = [];
    const onRead = vi.fn(() => {
      ran.push('onRead');

      return Promise.resolve();
    });

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
      onRead,
    });

    expect(onRead).toHaveBeenCalledOnce();
    expect(ran).toEqual(['scan', 'fetchLogos', 'detectSegments', 'onRead']);
  });

  it('fetches lettering before it looks for intros, being the cheaper of the two', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
      onRead: () => Promise.resolve(),
    });

    expect(ran.indexOf('fetchLogos')).toBeLessThan(ran.indexOf('detectSegments'));
  });

  it('reports what the reading phase changed', async () => {
    const onScanned = vi.fn(() => Promise.resolve());
    const work = spying([]);

    work.scan.mockResolvedValue({ added: 3, updated: 1, removed: 0, failed: 0 });

    await runScanPhases({
      work,
      isCancelled: () => false,
      onScanned,
      onRead: () => Promise.resolve(),
    });

    expect(onScanned).toHaveBeenCalledWith({ added: 3, updated: 1, removed: 0, failed: 0 });
  });

  it('says nothing about a reading phase that reported nothing', async () => {
    const onScanned = vi.fn(() => Promise.resolve());
    const work = spying([]);

    work.scan.mockResolvedValue(null);

    await runScanPhases({
      work,
      isCancelled: () => false,
      onScanned,
      onRead: () => Promise.resolve(),
    });

    expect(onScanned).not.toHaveBeenCalled();
  });

  it('still asks for the renders when the reading phase reported nothing', async () => {
    const work = spying([]);
    const onRead = vi.fn(() => Promise.resolve());

    work.scan.mockResolvedValue(null);

    await runScanPhases({
      work,
      isCancelled: () => false,
      onScanned: () => Promise.resolve(),
      onRead,
    });

    expect(onRead).toHaveBeenCalledOnce();
  });

  it('does nothing at all once cancelled', async () => {
    const ran: string[] = [];
    const onRead = vi.fn(() => Promise.resolve());

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => true,
      onScanned: () => Promise.resolve(),
      onRead,
    });

    expect(ran).toEqual([]);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('stops at the next phase boundary when cancelled part-way', async () => {
    const ran: string[] = [];

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => ran.length >= 2,
      onScanned: () => Promise.resolve(),
      onRead: () => Promise.resolve(),
    });

    expect(ran).toEqual(['scan', 'fetchLogos']);
  });

  it('asks for no renders when it was stopped, so stopping starts nothing', async () => {
    const ran: string[] = [];
    const onRead = vi.fn(() => Promise.resolve());

    await runScanPhases({
      work: spying(ran),
      isCancelled: () => ran.length >= 3,
      onScanned: () => Promise.resolve(),
      onRead,
    });

    expect(ran).toEqual(['scan', 'fetchLogos', 'detectSegments']);
    expect(onRead).not.toHaveBeenCalled();
  });
});
