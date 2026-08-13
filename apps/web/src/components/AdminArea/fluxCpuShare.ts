import type { Monitor } from '@FluxWeb/admin/fetchAdmin';

/**
 * How much of the whole machine Flux itself is using, as a percentage.
 *
 * The media service and every ffmpeg it started, counted together: the service
 * process alone is nearly idle whatever is happening, because the work is in
 * the conversions it spawns. Reporting the service on its own would say two
 * percent while twelve cores are pinned generating previews.
 *
 * A process is measured against one core, so a figure over a hundred means
 * more than one core saturated. Dividing by the core count puts it on the same
 * scale as the system reading it sits beside, so the two can be read against
 * each other.
 *
 * Null when there is nothing to divide by, rather than zero — a machine that
 * has not reported its cores yet is not a machine Flux is idle on.
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
