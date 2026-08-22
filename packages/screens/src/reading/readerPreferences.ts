import { z } from 'zod';
import { platformInUse } from '@ValenceClient/platform/installPlatform';
import type { ReadingDirection } from '@ValenceContracts/schemas/Book';

const STORAGE_KEY = 'valence.reader';

const FITS = ['width', 'height', 'both'] as const;

const FitSchema = z.enum(FITS);

const PreferencesSchema = z.object({
  isDouble: z.boolean(),
  isOffset: z.boolean(),
  fit: FitSchema,
  direction: z.enum(['rightToLeft', 'leftToRight']),
});

type ReaderFit = z.infer<typeof FitSchema>;

type ReaderPreferences = z.infer<typeof PreferencesSchema>;

/**
 * How somebody likes to read, as they last left it.
 *
 * Kept on the device rather than against the account, because it is a property of the screen: the
 * same person wants two pages on a desktop and one on a phone, and a setting that followed them
 * between the two would be wrong in one of them every time.
 *
 * The book's own direction is the starting point where nothing has been saved — manga right to left,
 * everything else the other way — and whatever somebody chooses after that is theirs.
 *
 * @param direction - Which way this book is read, where nobody has said otherwise.
 * @returns How to read, saved or defaulted.
 */
const readReaderPreferences = (direction: ReadingDirection): ReaderPreferences => {
  const held = platformInUse().store.read(STORAGE_KEY);
  const read = PreferencesSchema.safeParse(held === null ? null : JSON.parse(held));

  return read.success ? read.data : { isDouble: false, isOffset: true, fit: 'both', direction };
};

/**
 * Remembers how somebody likes to read.
 *
 * @param preferences - How they left it.
 */
const writeReaderPreferences = (preferences: ReaderPreferences): void => {
  platformInUse().store.write(STORAGE_KEY, JSON.stringify(preferences));
};

export type { ReaderFit, ReaderPreferences };

export { FITS, STORAGE_KEY, readReaderPreferences, writeReaderPreferences };
