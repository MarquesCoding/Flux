import { z } from 'zod'

/**
 * Where the way somebody likes to watch is remembered.
 *
 * On the device rather than on the account, for the same reason the chosen
 * profile is: a television in a living room and a laptop in bed are two
 * different sets of ears. A volume that followed the account would mean
 * somebody turning a film down on headphones and finding the television
 * whispering the next evening.
 */
const STORAGE_KEY = 'flux.playback'

/**
 * The language of a chosen subtitle track, or that they were switched off.
 *
 * Language rather than track: a track is named from the file it lives in, so
 * the identifier that means "English" for one episode means nothing for the
 * next. What a viewer chose was a language, and that is what carries.
 */
const SUBTITLES_OFF = 'off'

const PreferencesSchema = z.object({
  volume: z.number().min(0).max(1).default(1),
  isMuted: z.boolean().default(false),
  /**
   * Absent when nobody has expressed a preference, which is not the same as
   * having turned subtitles off: the first is "decide for me", the second is
   * an instruction.
   */
  subtitleLanguage: z.string().nullable().default(null),
  /**
   * Whether the clock counts down rather than up.
   *
   * Kept on the device like the rest of it: how somebody reads a running time
   * is a habit, and a habit that has to be re-expressed every film is not one
   * the interface is respecting.
   */
  showsRemaining: z.boolean().default(false),
})

type PlaybackPreferences = z.infer<typeof PreferencesSchema>

const DEFAULTS: PlaybackPreferences = {
  volume: 1,
  isMuted: false,
  subtitleLanguage: null,
  showsRemaining: false,
}

/**
 * How this device likes to watch.
 *
 * Falls back to the defaults rather than failing: a browser refusing storage
 * is a browser in private mode, and stored settings that no longer parse are
 * settings from an older version. Neither is a reason to stop playing a film.
 */
const readPlaybackPreferences = (): PlaybackPreferences => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (stored === null) {
      return DEFAULTS
    }

    const parsed = PreferencesSchema.safeParse(JSON.parse(stored))

    return parsed.success ? parsed.data : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

/**
 * Remembers a change to how this device likes to watch.
 *
 * Written as a whole rather than a field at a time, so what is stored is
 * always a complete set: a half-written record is one the reader has to guess
 * at, and it would guess wrong exactly once per browser.
 */
const writePlaybackPreferences = (change: Partial<PlaybackPreferences>): void => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readPlaybackPreferences(), ...change }),
    )
  } catch {
    // The setting lasts for this session instead of for this device, which is
    // a smaller loss than refusing to play anything.
  }
}

export type { PlaybackPreferences }

export default {
  readPlaybackPreferences,
  writePlaybackPreferences,
  STORAGE_KEY,
  SUBTITLES_OFF,
  DEFAULTS,
}
