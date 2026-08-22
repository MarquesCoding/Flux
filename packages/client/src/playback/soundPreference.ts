import { z } from 'zod';
import { platformInUse } from '@ValenceClient/platform/installPlatform';

const SoundPreferenceSchema = z.enum(['muted', 'audible']);

type SoundPreference = z.infer<typeof SoundPreferenceSchema>;

const STORAGE_KEY = 'flux.soundPreference';

const DEFAULT_SOUND_PREFERENCE: SoundPreference = 'muted';

/**
 * Reads whether this viewer has asked the clips a library page plays to be audible. Muted unless
 * somebody said otherwise, since a page that makes a noise nobody asked for is a page people turn
 * off rather than turn down.
 */
const readSoundPreference = (): SoundPreference => {
  const stored = platformInUse().store.read(STORAGE_KEY);

  if (stored === null) {
    return DEFAULT_SOUND_PREFERENCE;
  }

  const parsed = SoundPreferenceSchema.safeParse(stored);

  return parsed.success ? parsed.data : DEFAULT_SOUND_PREFERENCE;
};

/**
 * Remembers whether clips play with sound, on this device rather than for this person — somebody
 * who turns sound on for a laptop at night has said nothing about the television in the front room.
 *
 * @param preference - Whether clips should be audible.
 */
const saveSoundPreference = (preference: SoundPreference): void => {
  platformInUse().store.write(STORAGE_KEY, preference);
};

export type { SoundPreference };

export { DEFAULT_SOUND_PREFERENCE, STORAGE_KEY, readSoundPreference, saveSoundPreference };
