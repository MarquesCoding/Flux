import { describe, expect, it } from 'vitest';
import {
  findDisksUnderPressure,
  findMountFor,
  isUnderPressure,
  LOW_DISK_BYTES,
} from './findDisksUnderPressure';
import type { DiskUse } from './DiskUse';

const TERABYTE = 1024 * 1024 * 1024 * 1024;

const disk = (mountPoint: string, totalBytes: number, availableBytes: number): DiskUse => ({
  mountPoint,
  totalBytes,
  availableBytes,
});

describe('isUnderPressure', () => {
  it('leaves a disk with plenty of room alone', () => {
    expect(isUnderPressure(disk('/', 500 * LOW_DISK_BYTES, 400 * LOW_DISK_BYTES))).toBe(false);
  });

  it('warns on a small disk before the fraction would', () => {
    expect(isUnderPressure(disk('/', 250 * LOW_DISK_BYTES, LOW_DISK_BYTES - 1))).toBe(true);
  });

  it('warns on a large array before the absolute floor would', () => {
    expect(isUnderPressure(disk('/media', 20 * TERABYTE, 0.04 * 20 * TERABYTE))).toBe(true);
  });

  it('does not call a terabyte free on a large array an emergency', () => {
    expect(isUnderPressure(disk('/media', 20 * TERABYTE, TERABYTE))).toBe(false);
  });

  it('ignores a filesystem that reports no size', () => {
    expect(isUnderPressure(disk('/proc', 0, 0))).toBe(false);
  });
});

describe('findMountFor', () => {
  it('credits a path to the deepest mount it sits under', () => {
    const mounts = [disk('/', 100, 50), disk('/media', 100, 50)];

    expect(findMountFor('/media/films', mounts)?.mountPoint).toBe('/media');
  });

  it('does not mistake a sibling directory for a mount', () => {
    const mounts = [disk('/', 100, 50), disk('/media', 100, 50)];

    expect(findMountFor('/mediaserver/films', mounts)?.mountPoint).toBe('/');
  });

  it('matches a path that is itself a mount point', () => {
    expect(findMountFor('/media', [disk('/media', 100, 50)])?.mountPoint).toBe('/media');
  });

  it('answers nothing when the machine listed no filesystems', () => {
    expect(findMountFor('/media/films', [])).toBeNull();
  });
});

describe('findDisksUnderPressure', () => {
  it('says nothing while there is room', () => {
    const disks = [disk('/media', 20 * TERABYTE, 10 * TERABYTE)];

    expect(findDisksUnderPressure(['/media/films'], disks)).toStrictEqual([]);
  });

  it('finds the mount a library is running out of room on', () => {
    const disks = [disk('/media', 20 * TERABYTE, 1024)];

    expect(findDisksUnderPressure(['/media/films'], disks)).toHaveLength(1);
  });

  it('ignores a full disk Valence does not write to', () => {
    const disks = [disk('/media', 20 * TERABYTE, 10 * TERABYTE), disk('/snap/core', 1024, 0)];

    expect(findDisksUnderPressure(['/media/films'], disks)).toStrictEqual([]);
  });

  it('counts two libraries on one array as one problem', () => {
    const disks = [disk('/media', 20 * TERABYTE, 1024)];

    const found = findDisksUnderPressure(['/media/films', '/media/shows'], disks);

    expect(found).toHaveLength(1);
    expect(found[0]?.mountPoint).toBe('/media');
  });

  it('reports two different mounts separately', () => {
    const disks = [disk('/media', 20 * TERABYTE, 1024), disk('/cache', 20 * TERABYTE, 1024)];

    expect(findDisksUnderPressure(['/media/films', '/cache/images'], disks)).toHaveLength(2);
  });
});
