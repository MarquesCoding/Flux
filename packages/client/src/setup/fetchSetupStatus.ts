import { SetupStatusSchema } from '@ValenceContracts/schemas/Setup';
import type { SetupStatus } from '@ValenceContracts/schemas/Setup';

/**
 * Asks whether this server has been set up yet, which decides whether the application shows the
 * wizard or the way in.
 *
 * Its own module rather than a `fetch` inside the root component, so that the question can be asked
 * by whatever needs the answer instead of being asked once and handed down.
 *
 * @returns What the server said.
 */
const fetchSetupStatus = async (): Promise<SetupStatus> => {
  const response = await fetch('/api/setup/status', {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Setup status request failed with status ${response.status.toString()}`);
  }

  return SetupStatusSchema.parse(await response.json());
};

export { fetchSetupStatus };
