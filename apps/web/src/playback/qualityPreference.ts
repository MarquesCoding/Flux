import { z } from 'zod'
import { QUALITY_STEP_IDS } from '@FluxContracts/schemas/QualityStep'

const QualityPreferenceSchema = z.enum(['original', ...QUALITY_STEP_IDS])

type QualityPreference = z.infer<typeof QualityPreferenceSchema>

const STORAGE_KEY = 'flux.qualityPreference'

const DEFAULT_QUALITY_PREFERENCE: QualityPreference = 'original'

/**
 * Reads a viewer's quality preference.
 *
 * Anything unreadable or out of date falls back to Original rather than
 * throwing: a stale setting must not stop playback from starting.
 */
const readQualityPreference = (): QualityPreference => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (stored === null) {
      return DEFAULT_QUALITY_PREFERENCE
    }

    const parsed = QualityPreferenceSchema.safeParse(stored)

    return parsed.success ? parsed.data : DEFAULT_QUALITY_PREFERENCE
  } catch {
    return DEFAULT_QUALITY_PREFERENCE
  }
}

/**
 * Remembers a viewer's quality preference.
 *
 * Kept in the browser rather than on the server: a laptop on Wi-Fi and a TV
 * on ethernet want different defaults, and that is a property of the device
 * rather than the account.
 */
const saveQualityPreference = (preference: QualityPreference): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // A browser refusing storage is not a reason to stop playback.
  }
}

export type { QualityPreference }

export {
  QualityPreferenceSchema,
  DEFAULT_QUALITY_PREFERENCE,
  STORAGE_KEY,
  readQualityPreference,
  saveQualityPreference,
}
