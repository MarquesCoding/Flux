import { describe, expect, it, vi } from 'vitest';
import { createReachabilityWatch } from './createReachabilityWatch';

const watching = () => {
  const onLost = vi.fn();
  const onRegained = vi.fn();

  return { onLost, onRegained, watch: createReachabilityWatch({ onLost, onRegained }) };
};

describe('createReachabilityWatch', () => {
  it('says nothing while everything is fine', () => {
    const { onLost, onRegained, watch } = watching();

    watch.record(true);
    watch.record(true);

    expect(onLost).not.toHaveBeenCalled();
    expect(onRegained).not.toHaveBeenCalled();
  });

  it('speaks up the first time something goes down', () => {
    const { onLost, watch } = watching();

    watch.record(false);

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('does not say it again every five minutes for as long as it is down', () => {
    const { onLost, watch } = watching();

    watch.record(false);
    watch.record(false);
    watch.record(false);

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('says when something mends', () => {
    const { onRegained, watch } = watching();

    watch.record(false);
    watch.record(true);

    expect(onRegained).toHaveBeenCalledTimes(1);
  });

  it('does not keep saying it has mended on every check that passes', () => {
    const { onRegained, watch } = watching();

    watch.record(false);
    watch.record(true);
    watch.record(true);
    watch.record(true);

    expect(onRegained).toHaveBeenCalledTimes(1);
  });

  it('says nothing about mending on a server that never saw it break', () => {
    const { onRegained, watch } = watching();

    watch.record(true);

    expect(onRegained).not.toHaveBeenCalled();
  });

  it('follows something that goes down and comes back more than once', () => {
    const { onLost, onRegained, watch } = watching();

    watch.record(false);
    watch.record(true);
    watch.record(false);
    watch.record(true);

    expect(onLost).toHaveBeenCalledTimes(2);
    expect(onRegained).toHaveBeenCalledTimes(2);
  });

  it('assumes things were fine before anybody looked', () => {
    const { onLost, onRegained } = watching();

    expect(onLost).not.toHaveBeenCalled();
    expect(onRegained).not.toHaveBeenCalled();
  });
});
