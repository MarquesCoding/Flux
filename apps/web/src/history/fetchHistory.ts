import { ViewingListSchema, ForgottenSchema } from '@FluxContracts/schemas/Viewing';
import type { Viewing } from '@FluxContracts/schemas/Viewing';

const A_PAGE = 30;

/**
 * Reads what this profile has watched, most recent first, in pages — a household that has been using
 * Flux for a year has more history than any one request should carry.
 *
 * @param offset - How many viewings to read.
 * @returns The viewings, or none where the request failed.
 */
const fetchHistory = async (offset = 0): Promise<Viewing[]> => {
  try {
    const response = await fetch(
      `/api/history?limit=${A_PAGE.toString()}&offset=${offset.toString()}`,
      {
        headers: { accept: 'application/json' },
      },
    );

    if (!response.ok) {
      return [];
    }

    return ViewingListSchema.parse(await response.json()).viewings;
  } catch {
    return [];
  }
};

/**
 * Forgets one viewing, for somebody removing something from their own history.
 *
 * @param viewingId - The viewing to forget.
 */
const forgetViewing = async (viewingId: string): Promise<boolean> => {
  const response = await fetch(`/api/history/${viewingId}`, { method: 'DELETE' }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Forgets everything this profile has watched. Only this profile's: history hangs off the profile
 * rather than the account, so one person clearing theirs leaves the rest of the household alone.
 */
const forgetHistory = async (): Promise<number> => {
  try {
    const response = await fetch('/api/history', { method: 'DELETE' });

    if (!response.ok) {
      return 0;
    }

    return ForgottenSchema.parse(await response.json()).forgotten;
  } catch {
    return 0;
  }
};

export { fetchHistory, forgetViewing, forgetHistory, A_PAGE };
