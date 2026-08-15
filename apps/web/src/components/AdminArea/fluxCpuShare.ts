import type { Monitor } from '@FluxWeb/admin/fetchAdmin';

/**
 * How much of the whole machine Flux itself is using, as a percentage.
 */
const fluxCpuShare = (resources: Monitor['resources'] | null): number | null => {
  if (resources === null || resources.cpuCount <= 0) {
    return null;
  }

  const cores = resources.children.reduce(
    (total, child) => total + child.cpuPercent,
    resources.serviceCpuPercent,
  );

  if (!Number.isFinite(cores)) {
    return null;
  }

  return Math.min(100, Math.max(0, cores / resources.cpuCount));
};

export { fluxCpuShare };
