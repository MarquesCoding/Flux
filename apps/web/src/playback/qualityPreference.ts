import { z } from 'zod';
import { QUALITY_STEP_IDS } from '@FluxContracts/schemas/QualityStep';

const QualityPreferenceSchema = z.enum(['original', ...QUALITY_STEP_IDS]);

type QualityPreference = z.infer<typeof QualityPreferenceSchema>;

const STORAGE_KEY = 'flux.qualityPreference';

const DEFAULT_QUALITY_PREFERENCE: QualityPreference = 'original';

/**
 * Reads whether this viewer has pinned quality to a rung of the ladder or left it to be chosen. A
 * pinned choice is honoured even where the connection would carry more, since somebody who chose it
 * usually had a reason the player cannot see.
 */
const readQualityPreference = (): QualityPreference => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === null) {
      return DEFAULT_QUALITY_PREFERENCE;
    }

    const parsed = QualityPreferenceSchema.safeParse(stored);

    return parsed.success ? parsed.data : DEFAULT_QUALITY_PREFERENCE;
  } catch {
    return DEFAULT_QUALITY_PREFERENCE;
  }
};

/**
 * Remembers the quality a viewer chose, on this device — a phone on mobile data and a television on
 * a wire want different answers from the same account.
 *
 * @param preference - The step chosen, or original.
 */
const saveQualityPreference = (preference: QualityPreference): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {}
};

export type { QualityPreference };

export { DEFAULT_QUALITY_PREFERENCE, STORAGE_KEY, readQualityPreference, saveQualityPreference };
