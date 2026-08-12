import { describe, expect, it } from 'vitest';
import type { Monitor } from '@FluxWeb/admin/fetchAdmin';
import { fluxCpuShare } from './fluxCpuShare';

const resources = (overrides: Partial<Monitor['resources']> = {}): Monitor['resources'] => ({
  atMs: 0,
  systemCpuPercent: 0,
  systemMemoryUsedBytes: 0,
  systemMemoryTotalBytes: 0,
  cpuCount: 4,
  serviceCpuPercent: 0,
  serviceMemoryBytes: 0,
  children: [],
  loadAverage: 0,
  ...overrides,
});

const conversion = (cpuPercent: number) => ({ pid: 1, cpuPercent, memoryBytes: 0 });

describe('fluxCpuShare', () => {
  it('has nothing to say before the first reading', () => {
    expect(fluxCpuShare(null)).toBeNull();
  });

  it('does not divide by a machine with no cores', () => {
    expect(fluxCpuShare(resources({ cpuCount: 0, serviceCpuPercent: 50 }))).toBeNull();
  });

  it('puts one core of work on the scale of the whole machine', () => {
    expect(fluxCpuShare(resources({ serviceCpuPercent: 100 }))).toBe(25);
  });

  it('counts the conversions, not just the service', () => {
    expect(
      fluxCpuShare(
        resources({ serviceCpuPercent: 20, children: [conversion(180), conversion(200)] }),
      ),
    ).toBe(100);
  });

  it('reports an idle service as idle', () => {
    expect(fluxCpuShare(resources())).toBe(0);
  });

  it('never reports more of the machine than there is', () => {
    expect(fluxCpuShare(resources({ cpuCount: 2, children: [conversion(500)] }))).toBe(100);
  });

  it('refuses a reading it cannot make sense of', () => {
    expect(fluxCpuShare(resources({ serviceCpuPercent: Number.NaN }))).toBeNull();
  });
});
