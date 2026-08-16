import { z } from 'zod';
import { ViewerProfileListSchema } from '@FluxContracts/schemas/ViewerProfile';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const TwoFactorPendingSchema = z.object({ twoFactorRedirect: z.literal(true) });

/**
 * Everybody who could sign in on this server, which is what the way-in screen shows before anybody
 * has. Names and faces only — enough to be picked from, and nothing that says anything about the
 * accounts behind them.
 */
const fetchEveryone = async (): Promise<ViewerProfile[]> => {
  try {
    const response = await fetch('/api/profiles/everyone', {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    return ViewerProfileListSchema.parse(await response.json()).profiles;
  } catch {
    return [];
  }
};

/**
 * Signs somebody in by the face they picked, for a household where the television is already signed
 * in to the account and choosing a profile is the whole of the ceremony.
 *
 * @param profileId - Who picked.
 * @param password - Their PIN, where the profile has one.
 * @returns Whether it worked, and why not where it did not.
 */
const signInAsProfile = async (
  profileId: string,
  password: string,
): Promise<{ kind: 'signedIn' } | { kind: 'needsCode' } | { kind: 'refused'; reason: string }> => {
  const response = await fetch(`/api/profiles/${profileId}/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  }).catch(() => null);

  if (response === null) {
    return { kind: 'refused', reason: 'Flux could not be reached.' };
  }

  if (!response.ok) {
    return { kind: 'refused', reason: 'That password is not right.' };
  }

  const body = await response.text().catch(() => '');

  return TwoFactorPendingSchema.safeParse(JSON.parse(body === '' ? 'null' : body)).success
    ? { kind: 'needsCode' }
    : { kind: 'signedIn' };
};

export { fetchEveryone, signInAsProfile };
