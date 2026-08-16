import { PersonCreditsSchema, PersonSchema } from '@FluxContracts/schemas/Person';
import type { Person, PersonCredits } from '@FluxContracts/schemas/Person';

const NOTHING: PersonCredits = { films: [], shows: [], episodes: [] };

/**
 * Reads what the catalogue knows about somebody — their portrait, their biography, where and when
 * they were born. Answers with nothing rather than throwing, since a person's page is worth opening
 * for what this server holds of theirs even when the catalogue has nothing to say about them.
 *
 * @param personId - The catalogue's identifier for them.
 * @returns Who they are, or null where the catalogue answered nothing.
 */
const fetchPerson = async (personId: number): Promise<Person | null> => {
  try {
    const response = await fetch(`/api/people/${personId.toString()}`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return PersonSchema.parse(await response.json());
  } catch {
    return null;
  }
};

/**
 * Reads what of somebody's work is on this server, and only that. A filmography naming forty films
 * of which thirty-seven cannot be played is a list of things to be disappointed by, so this asks the
 * library rather than the catalogue.
 *
 * @param personId - The catalogue's identifier for them.
 * @returns The films, programmes and episodes of theirs held here.
 */
const fetchPersonCredits = async (personId: number): Promise<PersonCredits> => {
  try {
    const response = await fetch(`/api/people/${personId.toString()}/credits`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return NOTHING;
    }

    return PersonCreditsSchema.parse(await response.json());
  } catch {
    return NOTHING;
  }
};

export { fetchPerson, fetchPersonCredits };
