import type { Monitor } from '@ValenceClient/admin/fetchAdmin';

/**
 * Works out how much memory Valence itself is holding, counting every part of it: the API server, the
 * media service and every conversion it has running. Where the deployment can be read as a whole
 * that figure already covers all of them; where it cannot, they are added up one process at a time.
 * This is what separates "the box is full" from "Valence is full", which are different problems with
 * different answers.
 *
 * @param resources - The latest readings, or null before any have arrived.
 * @returns The bytes Valence is holding, or null where it cannot be worked out.
 */
const valenceMemoryUse = (resources: Monitor['resources'] | null): number | null => {
  if (resources === null) {
    return null;
  }

  const deployment = resources.deploymentMemory;

  if (deployment !== null && Number.isFinite(deployment.usedBytes)) {
    return Math.max(0, deployment.usedBytes);
  }

  const bytes = resources.children.reduce(
    (total, child) => total + child.memoryBytes,
    resources.serviceMemoryBytes + (resources.apiMemoryBytes ?? 0),
  );

  return Number.isFinite(bytes) ? Math.max(0, bytes) : null;
};

export { valenceMemoryUse };
