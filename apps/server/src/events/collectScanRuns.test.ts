import { describe, expect, it, vi } from 'vitest';
import { collectScanRuns } from './collectScanRuns';
import type { ScanRunReport } from './collectScanRuns';
import type { ScannedLibrary } from '@ValenceContracts/schemas/Webhook';

const aLibrary = (overrides: Partial<ScannedLibrary> = {}): ScannedLibrary => ({
  libraryId: 'library-1',
  libraryName: 'Movies',
  added: 1,
  updated: 0,
  removed: 0,
  failed: 0,
  arrived: ['Dune'],
  arrivedNotListed: 0,
  ...overrides,
});

const collecting = () => {
  const onFinished = vi.fn<(report: ScanRunReport) => void>();
  const waits: (() => void)[] = [];

  const runs = collectScanRuns({
    onFinished,
    givesUpAfterMilliseconds: 1000,
    wait: (run) => {
      waits.push(run);

      return { cancel: () => {} };
    },
  });

  return { runs, onFinished, giveUp: () => waits.forEach((one) => one()) };
};

describe('collectScanRuns', () => {
  it('reports a lone scan as soon as it finishes', () => {
    const { runs, onFinished } = collecting();

    runs.record('run-1', 1, aLibrary());

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0]?.[0].libraries).toHaveLength(1);
  });

  it('says nothing until every library in the scan has been heard from', () => {
    const { runs, onFinished } = collecting();

    runs.record('run-1', 2, aLibrary());

    expect(onFinished).not.toHaveBeenCalled();
  });

  it('reports two libraries scanned together as one message', () => {
    const { runs, onFinished } = collecting();

    runs.record('run-1', 2, aLibrary());
    runs.record('run-1', 2, aLibrary({ libraryId: 'library-2', libraryName: 'Shows', added: 3 }));

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0]?.[0].libraries.map((one) => one.libraryName)).toStrictEqual([
      'Movies',
      'Shows',
    ]);
  });

  it('adds the counts up across the whole scan', () => {
    const { runs, onFinished } = collecting();

    runs.record('run-1', 2, aLibrary({ added: 1, updated: 2 }));
    runs.record('run-1', 2, aLibrary({ libraryId: 'library-2', added: 3, updated: 4 }));

    expect(onFinished.mock.calls[0]?.[0]).toMatchObject({ added: 4, updated: 6 });
  });

  it('keeps two separate scans apart', () => {
    const { runs, onFinished } = collecting();

    runs.record('run-1', 1, aLibrary());
    runs.record('run-2', 1, aLibrary({ libraryId: 'library-2', libraryName: 'Shows' }));

    expect(onFinished).toHaveBeenCalledTimes(2);
  });

  it('counts one library once however often it reports, and keeps the latest', () => {
    const { runs, onFinished } = collecting();

    runs.record('run-1', 2, aLibrary({ added: 1 }));
    runs.record('run-1', 2, aLibrary({ added: 9 }));

    expect(onFinished).not.toHaveBeenCalled();

    runs.record('run-1', 2, aLibrary({ libraryId: 'library-2', libraryName: 'Shows' }));

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0]?.[0].libraries).toHaveLength(2);
    expect(onFinished.mock.calls[0]?.[0].libraries[0]?.added).toBe(9);
  });

  it('reports what did finish when the rest of a scan never does', () => {
    const { runs, onFinished, giveUp } = collecting();

    runs.record('run-1', 3, aLibrary());
    giveUp();

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0]?.[0].libraries).toHaveLength(1);
  });

  it('says nothing at all for a scan that never reported a library', () => {
    const { onFinished, giveUp } = collecting();

    giveUp();

    expect(onFinished).not.toHaveBeenCalled();
  });

  it('does not report a run twice when giving up after it already finished', () => {
    const { runs, onFinished, giveUp } = collecting();

    runs.record('run-1', 1, aLibrary());
    giveUp();

    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
