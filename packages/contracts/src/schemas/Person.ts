import { z } from 'zod';
import { MediaSummarySchema } from './Library';

const CAST_SHOWN = 12;

const CAST_STORED = 50;

const PersonSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  portraitUrl: z.string().nullable(),
  biography: z.string().nullable(),
  bornOn: z.string().nullable(),
  bornIn: z.string().nullable(),
});

const PersonCreditsSchema = z.object({
  films: z.array(MediaSummarySchema),
  shows: z.array(MediaSummarySchema),
  episodes: z.array(MediaSummarySchema),
});

type Person = z.infer<typeof PersonSchema>;
type PersonCredits = z.infer<typeof PersonCreditsSchema>;

/**
 * Decides whether there is enough about somebody to be worth opening. A cast member from a library
 * the catalogue never matched is a name and nothing else — no identifier, so nothing to look up and
 * nothing to find them in. Offering to open that is offering an empty dialog.
 *
 * @param personId - The catalogue's identifier for them, where the scan recorded one.
 * @returns Whether they can be opened.
 */
const canOpenPerson = (personId: number | null | undefined): personId is number =>
  typeof personId === 'number' && personId > 0;

/**
 * Whether a person's page has anything on it. Somebody the catalogue knows nothing about beyond a
 * name, and who appears in nothing else on this server, is a dialog with a heading and no body —
 * better not opened than opened empty.
 *
 * @param person - What the catalogue knows about them, or null where it answered nothing.
 * @param credits - What of theirs is on this server.
 * @returns Whether there is anything to show.
 */
const hasAnythingToShow = (person: Person | null, credits: PersonCredits): boolean => {
  const said =
    person !== null &&
    (person.biography !== null || person.bornOn !== null || person.bornIn !== null);

  const held = credits.films.length + credits.shows.length + credits.episodes.length;

  return said || held > 0;
};

export type { Person, PersonCredits };

export {
  PersonSchema,
  PersonCreditsSchema,
  canOpenPerson,
  hasAnythingToShow,
  CAST_SHOWN,
  CAST_STORED,
};
