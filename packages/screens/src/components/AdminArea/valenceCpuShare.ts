import type { Monitor } from '@ValenceClient/admin/fetchAdmin';

/**
 * Works out how much of the whole machine Valence itself is using, counting the server and every child
 * process it started, against the machine's core count. This is what separates "the box is busy"
 * from "Valence is busy", which are different problems with different answers.
 *
 * @param resources - The latest readings, or null before any have arrived.
 * @returns Valence's share of the machine as a percentage, or null where it cannot be worked out.
 */
const valenceCpuShare = (resources: Monitor['resources'] | null): number | null => {
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

export { valenceCpuShare };
