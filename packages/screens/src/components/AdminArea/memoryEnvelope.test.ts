import { describe, expect, it } from 'vitest';
import type { Monitor } from '@FluxClient/admin/fetchAdmin';
import { memoryEnvelope } from './memoryEnvelope';

const resources = (overrides: Partial<Monitor['resources']> = {}): Monitor['resources'] => ({
  atMs: 0,
  systemCpuPercent: 0,
  systemMemoryUsedBytes: 8 * 1024 ** 3,
  systemMemoryTotalBytes: 16 * 1024 ** 3,
  cpuCount: 4,
  serviceCpuPercent: 0,
  serviceMemoryBytes: 0,
  children: [],
  deploymentMemory: null,
  loadAverage: 0,
  disks: [],
  graphics: null,
  ...overrides,
});

describe('memoryEnvelope', () => {
  it('has nothing to say before the first reading', () => {
    expect(memoryEnvelope(null)).toBeNull();
  });

  it('measures against the machine where nothing narrower applies', () => {
    expect(memoryEnvelope(resources())).toEqual({
      usedBytes: 8 * 1024 ** 3,
      totalBytes: 16 * 1024 ** 3,
      isLimited: false,
    });
  });

  it('measures against the ceiling the deployment is held to', () => {
    expect(
      memoryEnvelope(
        resources({
          deploymentMemory: { usedBytes: 3 * 1024 ** 3, limitBytes: 4 * 1024 ** 3 },
        }),
      ),
    ).toEqual({ usedBytes: 3 * 1024 ** 3, totalBytes: 4 * 1024 ** 3, isLimited: true });
  });

  it('measures against the machine where the deployment has no ceiling', () => {
    expect(
      memoryEnvelope(
        resources({ deploymentMemory: { usedBytes: 3 * 1024 ** 3, limitBytes: null } }),
      ),
    ).toEqual({ usedBytes: 8 * 1024 ** 3, totalBytes: 16 * 1024 ** 3, isLimited: false });
  });

  it('does not divide by a machine with no memory', () => {
    expect(memoryEnvelope(resources({ systemMemoryTotalBytes: 0 }))).toBeNull();
  });

  it('refuses a ceiling of nothing rather than reporting everything as full', () => {
    expect(
      memoryEnvelope(resources({ deploymentMemory: { usedBytes: 1, limitBytes: 0 } }))?.isLimited,
    ).toBe(false);
  });
});
