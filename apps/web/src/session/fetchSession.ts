import { GetSessionResponseSchema } from '@FluxContracts/schemas/Session';
import type { SessionUser } from '@FluxContracts/schemas/Session';

/**
 * Reads the current session: who is signed in, what they may do, and whether they have got as far as
 * a second factor. The first thing the application asks, and what decides whether it shows the
 * library or the way in.
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
