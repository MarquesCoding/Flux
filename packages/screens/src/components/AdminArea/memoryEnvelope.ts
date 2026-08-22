import type { Monitor } from '@FluxClient/admin/fetchAdmin';

type MemoryEnvelope = {
  usedBytes: number;
  totalBytes: number;
  isLimited: boolean;
};

/**
 * Works out what memory is being used out of what there is to use, against whichever ceiling
 * actually applies. A container held to a limit is judged against that limit rather than against the
 * host's RAM, because the limit is what it will be killed for crossing and the host's total is a
 * number nothing in the container can reach.
 *
 * @param resources - The latest readings, or null before any have arrived.
 * @returns The used and total bytes and whether the total is a ceiling set on the deployment, or
 * null where there is nothing to measure against.
 */
const memoryEnvelope = (resources: Monitor['resources'] | null): MemoryEnvelope | null => {
  if (resources === null) {
    return null;
  }

  const deployment = resources.deploymentMemory;
  const limit = deployment?.limitBytes ?? null;

  if (deployment !== null && limit !== null && limit > 0 && Number.isFinite(deployment.usedBytes)) {
    return { usedBytes: deployment.usedBytes, totalBytes: limit, isLimited: true };
  }

  if (!(resources.systemMemoryTotalBytes > 0)) {
    return null;
  }

  return {
    usedBytes: resources.systemMemoryUsedBytes,
    totalBytes: resources.systemMemoryTotalBytes,
    isLimited: false,
  };
};

export { memoryEnvelope };
export type { MemoryEnvelope };
