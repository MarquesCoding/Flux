import { ViewingListSchema, ForgottenSchema } from '@FluxContracts/schemas/Viewing';
import type { Viewing } from '@FluxContracts/schemas/Viewing';

const A_PAGE = 30;

/**
 * What this profile has watched, most recent first.
 *
 * Answers with nothing rather than throwing, like every other read a page
 * makes. A history that cannot load is an empty history, not a broken page.
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
 * Forgets one viewing.
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
