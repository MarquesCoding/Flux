import { describe, expect, it } from 'vitest';
import { CAST_SHOWN, CAST_STORED, PersonSchema, canOpenPerson, hasAnythingToShow } from './Person';
import type { Person, PersonCredits } from './Person';
import type { MediaSummary } from './Library';

const NOBODY: PersonCredits = { films: [], shows: [], episodes: [] };

const A_FILM: MediaSummary = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: '2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  rating: null,
  genres: [],
};

const SOMEONE: Person = {
  id: 1245,
  name: 'Amy Adams',
  portraitUrl: null,
  biography: null,
  bornOn: null,
  bornIn: null,
};

describe('PersonSchema', () => {
  it('reads what the catalogue knows about somebody', () => {
    const parsed = PersonSchema.parse({
      id: 1245,
      name: 'Amy Adams',
      portraitUrl: '/portrait.jpg',
      biography: 'An actor.',
      bornOn: '1974-08-20',
      bornIn: 'Vicenza, Italy',
    });

    expect(parsed.name).toBe('Amy Adams');
  });

  it('refuses somebody with no identifier', () => {
    expect(() => PersonSchema.parse({ ...SOMEONE, id: 0 })).toThrow();
  });
});

describe('canOpenPerson', () => {
  it('opens somebody the catalogue gave an identifier', () => {
    expect(canOpenPerson(1245)).toBe(true);
  });

  it('will not open a name with nothing behind it', () => {
    expect(canOpenPerson(null)).toBe(false);
    expect(canOpenPerson(undefined)).toBe(false);
  });

  it('will not open an identifier that is not one', () => {
    expect(canOpenPerson(0)).toBe(false);
    expect(canOpenPerson(-3)).toBe(false);
  });
});

describe('hasAnythingToShow', () => {
  it('has nothing for somebody the catalogue never described and who is in nothing', () => {
    expect(hasAnythingToShow(null, NOBODY)).toBe(false);
    expect(hasAnythingToShow(SOMEONE, NOBODY)).toBe(false);
  });

  it('has something once the catalogue says anything about them', () => {
    expect(hasAnythingToShow({ ...SOMEONE, biography: 'An actor.' }, NOBODY)).toBe(true);
    expect(hasAnythingToShow({ ...SOMEONE, bornOn: '1974-08-20' }, NOBODY)).toBe(true);
    expect(hasAnythingToShow({ ...SOMEONE, bornIn: 'Vicenza' }, NOBODY)).toBe(true);
  });

  it('has something once this server holds anything of theirs', () => {
    expect(hasAnythingToShow(null, { ...NOBODY, films: [A_FILM] })).toBe(true);
  });

  it('does not count a portrait on its own, since a face alone says nothing', () => {
    expect(hasAnythingToShow({ ...SOMEONE, portraitUrl: '/portrait.jpg' }, NOBODY)).toBe(false);
  });
});

describe('the cast limits', () => {
  it('stores more than it shows, so a reverse lookup is not capped by a display choice', () => {
    expect(CAST_STORED).toBeGreaterThan(CAST_SHOWN);
  });
});
