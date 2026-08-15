import { z } from 'zod';
import { QUALITY_STEP_IDS } from '@FluxContracts/schemas/QualityStep';

const QualityPreferenceSchema = z.enum(['original', ...QUALITY_STEP_IDS]);

type QualityPreference = z.infer<typeof QualityPreferenceSchema>;

const STORAGE_KEY = 'flux.qualityPreference';

const DEFAULT_QUALITY_PREFERENCE: QualityPreference = 'original';

/**
 * Reads a viewer's quality preference.
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
 * Remembers a viewer's quality preference.
 */
const saveQualityPreference = (preference: QualityPreference): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {}
};

export type { QualityPreference };

export { DEFAULT_QUALITY_PREFERENCE, STORAGE_KEY, readQualityPreference, saveQualityPreference };
