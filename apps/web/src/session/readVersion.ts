import { z } from 'zod';

const HealthSchema = z.object({ version: z.string() });

const LOCAL = 'local.dev';

const UNRELEASED = new Set(['0.0.0', 'dev', '']);

/**
 * Says a version the way it should be read — the release where there is one, and the commit where
 * this is a development build, so a bug report names something that can be found.
 *
 * @param reported - What the server reported.
 * @returns The version as it should be shown.
 */
const describeVersion = (reported: string): string =>
  UNRELEASED.has(reported.trim()) ? LOCAL : reported;

/**
 * Which version of Flux this is, as the server reports it — worth having in the interface so that a
 * problem can be reported against a version rather than against "the latest".
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
