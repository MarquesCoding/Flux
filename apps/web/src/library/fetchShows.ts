import { ShowListSchema, ShowDetailSchema } from '@FluxContracts/schemas/Show';
import type { ShowDetail, ShowSummary } from '@FluxContracts/schemas/Show';

/**
 * Reads the programmes in a library, grouped by the server so that a page of sixty things is sixty
 * programmes rather than sixty episodes of one.
 *
 * @param libraryId - The library to read.
 * @returns Its programmes.
 */
const fetchShows = async (libraryId: string): Promise<ShowSummary[]> => {
  try {
    const response = await fetch(`/api/libraries/${libraryId}/shows`, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    return ShowListSchema.parse(await response.json()).shows;
  } catch {
    return [];
  }
};

/**
 * Reads one programme and every episode the library holds of it, along with the catalogue's own shape
 * where it knows one, which is what makes a missing episode visible.
 *
 * @param libraryId - The library it is in.
 * @param showId - Which programme.
 * @returns The programme, or null where the library holds no such thing.
 */
const fetchShow = async (libraryId: string, showId: string): Promise<ShowDetail | null> => {
  try {
    const response = await fetch(`/api/libraries/${libraryId}/shows/${showId}`, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return ShowDetailSchema.parse(await response.json());
  } catch {
    return null;
  }
};

export { fetchShows, fetchShow };
