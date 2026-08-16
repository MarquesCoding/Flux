import { ViewingListSchema, ForgottenSchema } from '@FluxContracts/schemas/Viewing';
import type { Viewing } from '@FluxContracts/schemas/Viewing';

const A_PAGE = 30;

/**
 * Reads what this profile has watched, most recent first.
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
 * Forgets everything this profile has watched.
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
