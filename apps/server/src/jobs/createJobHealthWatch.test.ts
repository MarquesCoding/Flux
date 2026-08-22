import { describe, expect, it, vi } from 'vitest';
import { createJobHealthWatch } from './createJobHealthWatch';

const finished = (kind: string, reason: string | null) => ({
  kind,
  jobId: 'job',
  subject: null,
  reason,
});

describe('createJobHealthWatch', () => {
  it('says nothing about a job that failed once and is being retried', () => {
    const onStalled = vi.fn();

    const watch = createJobHealthWatch({ onStalled, onWorking: vi.fn() });

    watch.record(finished('server.checkDiskSpace', 'no'));
    watch.record(finished('server.checkDiskSpace', 'no'));

    expect(onStalled).not.toHaveBeenCalled();
  });

  it('speaks up once a firing has failed all the way through', () => {
    const onStalled = vi.fn();

    const watch = createJobHealthWatch({ onStalled, onWorking: vi.fn() });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      watch.record(finished('server.checkDiskSpace', 'the disk is gone'));
    }

    expect(onStalled).toHaveBeenCalledWith({
      kind: 'server.checkDiskSpace',
      failures: 3,
      everSucceeded: false,
      reason: 'the disk is gone',
    });
  });

  it('says it once rather than on every failure after it', () => {
    const onStalled = vi.fn();

    const watch = createJobHealthWatch({ onStalled, onWorking: vi.fn() });

    for (let attempt = 0; attempt < 1211; attempt += 1) {
      watch.record(finished('server.checkTranscoder', 'null'));
    }

    expect(onStalled).toHaveBeenCalledTimes(1);
  });

  it('tells a kind that has never once worked from one that has stopped working', () => {
    const onStalled = vi.fn();

    const watch = createJobHealthWatch({ onStalled, onWorking: vi.fn() });

    watch.record(finished('library.scan', null));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      watch.record(finished('library.scan', 'the library is gone'));
    }

    expect(onStalled).toHaveBeenCalledWith(expect.objectContaining({ everSucceeded: true }));
  });

  it('forgets the failures once the job runs', () => {
    const onStalled = vi.fn();

    const watch = createJobHealthWatch({ onStalled, onWorking: vi.fn() });

    watch.record(finished('library.scan', 'no'));
    watch.record(finished('library.scan', 'no'));
    watch.record(finished('library.scan', null));
    watch.record(finished('library.scan', 'no'));
    watch.record(finished('library.scan', 'no'));

    expect(onStalled).not.toHaveBeenCalled();
  });

  it('says when a stalled kind is working again, once', () => {
    const onWorking = vi.fn();

    const watch = createJobHealthWatch({ onStalled: vi.fn(), onWorking });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      watch.record(finished('server.checkTranscoder', 'no'));
    }

    watch.record(finished('server.checkTranscoder', null));
    watch.record(finished('server.checkTranscoder', null));

    expect(onWorking).toHaveBeenCalledTimes(1);
    expect(onWorking).toHaveBeenCalledWith('server.checkTranscoder');
  });

  it('says nothing about a job that has only ever worked', () => {
    const onWorking = vi.fn();

    const watch = createJobHealthWatch({ onStalled: vi.fn(), onWorking });

    watch.record(finished('library.scan', null));

    expect(onWorking).not.toHaveBeenCalled();
  });

  it('keeps every kind apart', () => {
    const onStalled = vi.fn();

    const watch = createJobHealthWatch({ onStalled, onWorking: vi.fn() });

    watch.record(finished('library.scan', 'no'));
    watch.record(finished('server.checkDiskSpace', 'no'));
    watch.record(finished('library.scan', 'no'));

    expect(onStalled).not.toHaveBeenCalled();
  });

  it('lists what is stalled, so a dashboard can say so rather than only a webhook', () => {
    const watch = createJobHealthWatch({ onStalled: vi.fn(), onWorking: vi.fn() });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      watch.record(finished('server.sendMediaDigest', 'no digest'));
    }

    expect(watch.stalled()).toEqual([
      {
        kind: 'server.sendMediaDigest',
        failures: 3,
        everSucceeded: false,
        reason: 'no digest',
      },
    ]);
  });

  it('has nothing to list while everything is working', () => {
    const watch = createJobHealthWatch({ onStalled: vi.fn(), onWorking: vi.fn() });

    watch.record(finished('library.scan', null));

    expect(watch.stalled()).toEqual([]);
  });
});
