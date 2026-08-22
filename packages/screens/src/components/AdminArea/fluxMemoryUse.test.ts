import { describe, expect, it } from 'vitest';
import type { Monitor } from '@FluxClient/admin/fetchAdmin';
import { fluxMemoryUse } from './fluxMemoryUse';

const resources = (overrides: Partial<Monitor['resources']> = {}): Monitor['resources'] => ({
  atMs: 0,
  systemCpuPercent: 0,
  systemMemoryUsedBytes: 0,
  systemMemoryTotalBytes: 0,
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

const conversion = (memoryBytes: number) => ({ pid: 1, cpuPercent: 0, memoryBytes });

describe('fluxMemoryUse', () => {
  it('has nothing to say before the first reading', () => {
    expect(fluxMemoryUse(null)).toBeNull();
  });

  it('counts the conversions, not just the service', () => {
    expect(
      fluxMemoryUse(
        resources({
          serviceMemoryBytes: 16 * 1024 ** 2,
          children: [conversion(200 * 1024 ** 2), conversion(140 * 1024 ** 2)],
        }),
      ),
    ).toEqual({ usedBytes: 356 * 1024 ** 2, scope: 'mediaService' });
  });

  it('says it is only speaking for the media service where that is all it can see', () => {
    expect(fluxMemoryUse(resources({ serviceMemoryBytes: 1 }))?.scope).toBe('mediaService');
  });

  it('prefers what the whole deployment is using, which includes the API server', () => {
    expect(
      fluxMemoryUse(
        resources({
          serviceMemoryBytes: 16 * 1024 ** 2,
          children: [conversion(200 * 1024 ** 2)],
          deploymentMemory: { usedBytes: 900 * 1024 ** 2, limitBytes: null },
        }),
      ),
    ).toEqual({ usedBytes: 900 * 1024 ** 2, scope: 'deployment' });
  });

  it('reports an idle service as idle rather than as unmeasured', () => {
    expect(fluxMemoryUse(resources())).toEqual({ usedBytes: 0, scope: 'mediaService' });
  });

  it('refuses a reading it cannot make sense of', () => {
    expect(fluxMemoryUse(resources({ serviceMemoryBytes: Number.NaN }))).toBeNull();
  });

  it('falls back to the processes it can see when the deployment reading makes no sense', () => {
    expect(
      fluxMemoryUse(
        resources({
          serviceMemoryBytes: 5,
          deploymentMemory: { usedBytes: Number.NaN, limitBytes: null },
        }),
      ),
    ).toEqual({ usedBytes: 5, scope: 'mediaService' });
  });
});
