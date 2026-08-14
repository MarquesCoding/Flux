import { describe, expect, it, vi } from 'vitest';
import { createReachabilityWatch } from './createReachabilityWatch';

describe('createReachabilityWatch', () => {
  it('says nothing while everything is fine', () => {
    const onLost = vi.fn();
    const watch = createReachabilityWatch({ onLost });

    watch.record(true);
    watch.record(true);

    expect(onLost).not.toHaveBeenCalled();
  });

  it('speaks up the first time something goes down', () => {
    const onLost = vi.fn();
    const watch = createReachabilityWatch({ onLost });

    watch.record(false);

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('does not say it again every five minutes for as long as it is down', () => {
    const onLost = vi.fn();
    const watch = createReachabilityWatch({ onLost });

    watch.record(false);
    watch.record(false);
    watch.record(false);

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('is re-armed by a recovery, so the next outage is announced too', () => {
    const onLost = vi.fn();
    const watch = createReachabilityWatch({ onLost });

    watch.record(false);
    watch.record(true);
    watch.record(false);

    expect(onLost).toHaveBeenCalledTimes(2);
  });

  it('assumes things were fine before anybody looked', () => {
    const onLost = vi.fn();

    createReachabilityWatch({ onLost });

    expect(onLost).not.toHaveBeenCalled();
  });
});
