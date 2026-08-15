import { GetSessionResponseSchema } from '@FluxContracts/schemas/Session';
import type { SessionUser } from '@FluxContracts/schemas/Session';

/**
 * Reads the current session.
 */
const fetchSession = async (): Promise<SessionUser | null> => {
  const response = await fetch('/api/auth/get-session', {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Session request failed with status ${response.status.toString()}`);
  }

  const parsed = GetSessionResponseSchema.parse(await response.json());

  return parsed === null ? null : parsed.user;
};

export { fetchSession };
