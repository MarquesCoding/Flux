import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

/**
 * Adds what this process is holding to a monitor reading, so that what Flux costs counts both halves
 * of it rather than the media service alone. The media service cannot see this one — the container
 * starts them as siblings and nothing spawns the other — but this one is the process handing the
 * reading on, and it knows its own resident set exactly.
 *
 * @param reading - What the media service reported.
 * @returns The reading with this process's memory in it, or the reading untouched where it is not
 * shaped like one.
 */
const withApiMemory = (reading: JsonValue): JsonValue => {
  if (reading === null || typeof reading !== 'object' || Array.isArray(reading)) {
    return reading;
  }

  const resources = reading.resources;

  if (
    resources === undefined ||
    resources === null ||
    typeof resources !== 'object' ||
    Array.isArray(resources)
  ) {
    return reading;
  }

  return {
    ...reading,
    resources: { ...resources, apiMemoryBytes: process.memoryUsage.rss() },
  };
};

export { withApiMemory };
