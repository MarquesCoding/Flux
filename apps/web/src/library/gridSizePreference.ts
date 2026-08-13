import { z } from 'zod';
import type { MediaGridSize } from '@FluxWeb/components/MediaGrid/MediaGrid.types';

const GridSizePreferenceSchema = z.enum(['small', 'medium', 'large']);

const STORAGE_KEY = 'flux.gridSize';

const DEFAULT_GRID_SIZE: MediaGridSize = 'medium';

/**
 * Reads how large this viewer likes the cards.
 *
 * Anything unreadable falls back to the middle size rather than throwing: a
 * stale setting must not stop a page from drawing.
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
 * Remembers how large this viewer likes the cards.
 *
 * Kept in the browser rather than on the account, for the same reason quality
 * is: the right answer depends on the screen it is being read on, and a phone
 * and a television are not one viewer's one preference.
 */
const saveGridSize = (size: MediaGridSize): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, size);
  } catch {}
};

export { GridSizePreferenceSchema, DEFAULT_GRID_SIZE, STORAGE_KEY, readGridSize, saveGridSize };
