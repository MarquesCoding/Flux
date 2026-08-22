import { describe, expect, it } from 'vitest';
import type { Monitor } from '@ValenceClient/admin/fetchAdmin';
import { valenceMemoryUse } from './valenceMemoryUse';

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
  apiMemoryBytes: null,
  loadAverage: 0,
  disks: [],
  graphics: null,
  ...overrides,
});

const conversion = (memoryBytes: number) => ({ pid: 1, cpuPercent: 0, memoryBytes });

describe('valenceMemoryUse', () => {
  it('has nothing to say before the first reading', () => {
    expect(valenceMemoryUse(null)).toBeNull();
  });

  it('counts the conversions, not just the service', () => {
    expect(
      valenceMemoryUse(
        resources({
          serviceMemoryBytes: 16 * 1024 ** 2,
          children: [conversion(200 * 1024 ** 2), conversion(140 * 1024 ** 2)],
        }),
      ),
    ).toBe(356 * 1024 ** 2);
  });

  it('counts the API server, which is the half that allocates most', () => {
    expect(
      valenceMemoryUse(
        resources({ serviceMemoryBytes: 16 * 1024 ** 2, apiMemoryBytes: 300 * 1024 ** 2 }),
      ),
    ).toBe(316 * 1024 ** 2);
  });

  it('takes the deployment whole rather than adding its parts up twice', () => {
    expect(
      valenceMemoryUse(
        resources({
          serviceMemoryBytes: 16 * 1024 ** 2,
          apiMemoryBytes: 300 * 1024 ** 2,
          children: [conversion(200 * 1024 ** 2)],
          deploymentMemory: { usedBytes: 900 * 1024 ** 2, limitBytes: null },
        }),
      ),
    ).toBe(900 * 1024 ** 2);
  });

  it('reports an idle Valence as idle rather than as unmeasured', () => {
    expect(valenceMemoryUse(resources())).toBe(0);
  });

  it('refuses a reading it cannot make sense of', () => {
    expect(valenceMemoryUse(resources({ serviceMemoryBytes: Number.NaN }))).toBeNull();
  });

  it('falls back to the processes it can see when the deployment reading makes no sense', () => {
    expect(
      valenceMemoryUse(
        resources({
          serviceMemoryBytes: 5,
          deploymentMemory: { usedBytes: Number.NaN, limitBytes: null },
        }),
      ),
    ).toBe(5);
  });
});
