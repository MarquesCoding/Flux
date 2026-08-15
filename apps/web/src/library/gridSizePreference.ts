import { z } from 'zod';
import type { MediaGridSize } from '@FluxWeb/components/MediaGrid/MediaGrid.types';

const GridSizePreferenceSchema = z.enum(['small', 'medium', 'large']);

const STORAGE_KEY = 'flux.gridSize';

const DEFAULT_GRID_SIZE: MediaGridSize = 'medium';

/**
 * Reads how large this viewer likes the cards.
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
 */
const saveGridSize = (size: MediaGridSize): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, size);
  } catch {}
};

export { DEFAULT_GRID_SIZE, STORAGE_KEY, readGridSize, saveGridSize };
