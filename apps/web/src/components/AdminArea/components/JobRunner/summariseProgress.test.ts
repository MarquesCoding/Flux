import { describe, expect, it } from 'vitest';
import { summariseProgress } from './summariseProgress';
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator';

const entry = (
  phase: string | null,
  processed: number | null,
  total: number | null,
): ScanEntry => ({ kind: 'library.scan', phase, processed, total });

describe('summariseProgress', () => {
  it('puts the Run button back when nothing is running', () => {
    expect(summariseProgress([])).toBeNull();
  });

  it('reports a single library as it stands', () => {
    expect(summariseProgress([entry('probing', 3, 10)])).toEqual({
      phase: 'probing',
      processed: 3,
      total: 10,
    });
  });

  it('adds up the libraries on the same stage', () => {
    expect(summariseProgress([entry('previews', 3, 10), entry('previews', 4, 6)])).toEqual({
      phase: 'previews',
      processed: 7,
      total: 16,
    });
  });

  it('reports the stage the job as a whole is still on, not the one furthest ahead', () => {
    expect(summariseProgress([entry('segments', 9, 9), entry('probing', 1, 40)])).toEqual({
      phase: 'probing',
      processed: 1,
      total: 40,
    });
  });

  it('never adds one stage of work to another, which would count files twice', () => {
    const summary = summariseProgress([entry('probing', 1, 40), entry('segments', 9, 9)]);

    expect(summary?.total).toBe(40);
  });

  it('treats a library that has said nothing yet as being at the start', () => {
    expect(summariseProgress([entry(null, null, null), entry('previews', 2, 5)])).toEqual({
      phase: null,
      processed: null,
      total: null,
    });
  });

  it('sorts a stage it has never heard of last rather than claiming the job restarted', () => {
    expect(summariseProgress([entry('somethingNew', 1, 2), entry('previews', 3, 4)])).toEqual({
      phase: 'previews',
      processed: 3,
      total: 4,
    });
  });

  it('keeps the stage name when a library on it has no count yet', () => {
    expect(summariseProgress([entry('segments', null, null)])).toEqual({
      phase: 'segments',
      processed: null,
      total: null,
    });
  });

  it('keeps a stage with nothing to do, rather than dropping it from the count', () => {
    expect(summariseProgress([entry('previews', 0, 0), entry('previews', 2, 4)])).toEqual({
      phase: 'previews',
      processed: 2,
      total: 4,
    });
  });
});
