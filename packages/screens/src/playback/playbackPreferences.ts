import { z } from 'zod';

const STORAGE_KEY = 'valence.playback';

const SUBTITLES_OFF = 'off';

const PreferencesSchema = z.object({
  volume: z.number().min(0).max(1).default(1),
  isMuted: z.boolean().default(false),
  subtitleLanguage: z.string().nullable().default(null),
  showsRemaining: z.boolean().default(false),
});

type PlaybackPreferences = z.infer<typeof PreferencesSchema>;

const DEFAULTS: PlaybackPreferences = {
  volume: 1,
  isMuted: false,
  subtitleLanguage: null,
  showsRemaining: false,
};

/**
 * How this device likes to watch: the volume, whether the clock counts down, and the rest of what
 * survives between sessions. Held on the device rather than on the profile, since these follow the
 * screen and the speakers rather than the person.
 */
const readPlaybackPreferences = (): PlaybackPreferences => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === null) {
      return DEFAULTS;
    }

    const parsed = PreferencesSchema.safeParse(JSON.parse(stored));

    return parsed.success ? parsed.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
};

/**
 * Remembers a change to how this device likes to watch — volume, mute, subtitle language. Kept on
 * the device rather than the account, since the right volume is a property of the room.
 *
 * @param change - What changed.
 */
const writePlaybackPreferences = (change: Partial<PlaybackPreferences>): void => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readPlaybackPreferences(), ...change }),
    );
  } catch {}
};

export { readPlaybackPreferences, writePlaybackPreferences, STORAGE_KEY, SUBTITLES_OFF, DEFAULTS };
