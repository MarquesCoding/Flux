import { z } from 'zod';

const HealthSchema = z.object({ version: z.string() });

const LOCAL = 'local.dev';

const UNRELEASED = new Set(['0.0.0', 'dev', '']);

/**
 * Says a version the way it should be read.
 */
const describeVersion = (reported: string): string =>
  UNRELEASED.has(reported.trim()) ? LOCAL : reported;

/**
 * Which version of Flux this is.
 */
const readVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/health', { headers: { accept: 'application/json' } });

    if (!response.ok) {
      return null;
    }

    return describeVersion(HealthSchema.parse(await response.json()).version);
  } catch {
    return null;
  }
};

export { readVersion, describeVersion, LOCAL };
