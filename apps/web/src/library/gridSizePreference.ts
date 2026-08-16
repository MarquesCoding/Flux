import { z } from 'zod';
import type { MediaGridSize } from '@FluxWeb/components/MediaGrid/MediaGrid.types';

const GridSizePreferenceSchema = z.enum(['small', 'medium', 'large']);

const STORAGE_KEY = 'flux.gridSize';

const DEFAULT_GRID_SIZE: MediaGridSize = 'medium';

/**
 * Reads how large this viewer likes the cards. Held on the device rather than on the profile, since
 * the right size depends on the screen being looked at rather than on who is looking.
 */
const readGridSize = (): MediaGridSize => {
  try {
    const parsed = GridSizePreferenceSchema.safeParse(window.localStorage.getItem(STORAGE_KEY));

    return parsed.success ? parsed.data : DEFAULT_GRID_SIZE;
  } catch {
    return DEFAULT_GRID_SIZE;
  }
};

/**
 * Remembers how large this viewer likes the cards, on this device — a phone and a television want
 * different answers from the same account.
 *
 * @param size - The size chosen.
 */
const saveGridSize = (size: MediaGridSize): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, size);
  } catch {}
};

export { DEFAULT_GRID_SIZE, STORAGE_KEY, readGridSize, saveGridSize };
