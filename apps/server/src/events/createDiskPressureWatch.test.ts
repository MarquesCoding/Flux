import { describe, expect, it, vi } from 'vitest';
import { createDiskPressureWatch } from './createDiskPressureWatch';
import type { DiskUse } from '@FluxServer/maintenance/DiskUse';
import type { Mock } from 'vitest';

type Told = (disk: DiskUse) => void;

const disk = (mountPoint: string, availableBytes = 1024): DiskUse => ({
  mountPoint,
  totalBytes: 1_000_000,
  availableBytes,
});

const watching = () => {
  const onLow: Mock<Told> = vi.fn<Told>();
  const onRecovered: Mock<Told> = vi.fn<Told>();

  return { onLow, onRecovered, watch: createDiskPressureWatch({ onLow, onRecovered }) };
};

describe('createDiskPressureWatch', () => {
  it('says nothing while every disk has room', () => {
    const { onLow, watch } = watching();

    watch.record([disk('/media')], []);
    watch.record([disk('/media')], []);

    expect(onLow).not.toHaveBeenCalled();
  });

  it('speaks up the first time a disk runs out', () => {
    const { onLow, watch } = watching();

    watch.record([disk('/media')], [disk('/media')]);

    expect(onLow).toHaveBeenCalledTimes(1);
    expect(onLow.mock.calls[0]?.[0]).toMatchObject({ mountPoint: '/media' });
  });

  it('does not say it again on every reading while it stays full', () => {
    const { onLow, watch } = watching();

    watch.record([disk('/media')], [disk('/media')]);
    watch.record([disk('/media')], [disk('/media')]);
    watch.record([disk('/media')], [disk('/media')]);

    expect(onLow).toHaveBeenCalledTimes(1);
  });

  it('says when room is made', () => {
    const { onRecovered, watch } = watching();

    watch.record([disk('/media')], [disk('/media')]);
    watch.record([disk('/media', 900_000)], []);

    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(onRecovered.mock.calls[0]?.[0]).toMatchObject({ availableBytes: 900_000 });
  });

  it('keeps one disk from silencing another', () => {
    const { onLow, watch } = watching();

    watch.record([disk('/media'), disk('/cache')], [disk('/media')]);
    watch.record([disk('/media'), disk('/cache')], [disk('/media'), disk('/cache')]);

    expect(onLow).toHaveBeenCalledTimes(2);
    expect(onLow.mock.calls.map((call) => call[0].mountPoint)).toStrictEqual(['/media', '/cache']);
  });

  it('does not call an unmounted disk recovered', () => {
    const { onRecovered, watch } = watching();

    watch.record([disk('/media')], [disk('/media')]);
    watch.record([], []);

    expect(onRecovered).not.toHaveBeenCalled();
  });

  it('reports the room left at the moment it crossed', () => {
    const { onLow, watch } = watching();

    watch.record([disk('/media', 512)], [disk('/media', 512)]);

    expect(onLow.mock.calls[0]?.[0]).toMatchObject({ availableBytes: 512 });
  });
});
