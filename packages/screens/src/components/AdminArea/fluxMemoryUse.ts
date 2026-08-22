import type { Monitor } from '@FluxClient/admin/fetchAdmin';

type MemoryScope = 'deployment' | 'mediaService';

type FluxMemoryUse = {
  usedBytes: number;
  scope: MemoryScope;
};

/**
 * Works out how much memory Flux itself is holding, and how much of Flux that figure covers. Where
 * the deployment can be read it is everything Flux runs, API server included; where it cannot — a
 * development machine with no cgroup — it is the media service and every conversion it started,
 * which is the most that can honestly be claimed there.
 *
 * @param resources - The latest readings, or null before any have arrived.
 * @returns The bytes and what they cover, or null where nothing can be worked out.
 */
const fluxMemoryUse = (resources: Monitor['resources'] | null): FluxMemoryUse | null => {
  if (resources === null) {
    return null;
  }

  const deployment = resources.deploymentMemory;

  if (deployment !== null && Number.isFinite(deployment.usedBytes)) {
    return { usedBytes: Math.max(0, deployment.usedBytes), scope: 'deployment' };
  }

  const bytes = resources.children.reduce(
    (total, child) => total + child.memoryBytes,
    resources.serviceMemoryBytes,
  );

  return Number.isFinite(bytes) ? { usedBytes: Math.max(0, bytes), scope: 'mediaService' } : null;
};

export { fluxMemoryUse };
export type { FluxMemoryUse, MemoryScope };
