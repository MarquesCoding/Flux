import { z } from 'zod';

/**
 * The sections a URL may name.
 *
 * Matched against the same list the shell uses, so an address somebody typed
 * or kept from an older version cannot put the application into a section it
 * does not have.
 */
const SECTIONS = [
  'home',
  'shows',
  'films',
  'new',
  'favourites',
  'search',
  'account',
  'admin',
] as const;

const SectionSchema = z.enum(SECTIONS);

/**
 * Where somebody is, as the address bar records it.
 *
 * Everything that decides what is on screen: which section, what was searched
 * for, what is open, and what is playing. A reload reads this back and lands
 * in the same place, which is what makes the back button and a shared link
 * work at all.
 */
type Place = {
  section: (typeof SECTIONS)[number];
  search: string;
  /**
   * The item whose page is open, if one is.
   */
  inspecting: string | null;
  /**
   * The series whose page is open, if one is.
   *
   * Held apart from the item being read about: a show and an episode are
   * different things to have open, and closing the episode should leave the
   * show where it was.
   */
  show: string | null;
  /**
   * The item being watched, if one is.
   */
  playing: string | null;
  /**
   * The genre a search is narrowed to, if one is.
   *
   * In the address rather than held by the page, so that a genre is a place
   * somebody can be sent to — which is what makes a footer full of them worth
   * having — and so the back button undoes choosing one.
   */
  genre: string | null;
  /**
   * The library being browsed, if one has been chosen.
   *
   * In the address for the same reason a genre is: a library is a place
   * somebody can be sent to, and a reload that lands back on whichever
   * library happens to be first is a reload that loses where they were.
   */
  library: string | null;
  /**
   * Which panel of the admin page is open, when the section is admin.
   *
   * Kept in the address for the same reason everything else here is: a
   * reload of the admin page should land on the panel somebody was looking
   * at, not reset to the first one.
   */
  adminPanel: string | null;
  /**
   * Which job's schedule page is open, when the section is admin.
   *
   * Its own field rather than folded into `inspecting` — that is for a media
   * item, and a job kind is not one.
   */
  adminJob: string | null;
};

const HOME: Place = {
  section: 'home',
  search: '',
  inspecting: null,
  show: null,
  playing: null,
  genre: null,
  library: null,
  adminPanel: null,
  adminJob: null,
};

/**
 * Reads a place out of an address.
 *
 * Anything unrecognised falls back to home rather than failing: an address is
 * something people edit, share and keep, and a bad one should land somewhere
 * sensible rather than on an error.
 */
const readLocation = (url: string): Place => {
  const parsed = URL.parse(url);

  if (parsed === null) {
    return HOME;
  }

  const [, first = '', second = ''] = parsed.pathname.split('/');
  const query = parsed.searchParams;

  const section = SectionSchema.safeParse(first);
  const watching = first === 'watch' && second !== '' ? second : null;

  return {
    section: section.success ? section.data : 'home',
    search: query.get('q') ?? '',
    inspecting: first === 'media' && second !== '' ? second : query.get('item'),
    show: query.get('show'),
    playing: watching,
    genre: query.get('genre'),
    library: query.get('library'),
    adminPanel: query.get('panel'),
    adminJob: query.get('job'),
  };
};

/**
 * Writes a place back as an address.
 *
 * Watching owns the path, because it is the thing worth sending somebody. An
 * item being read about is a query, since it sits over whatever section it was
 * opened from and should return there when it closes.
 *
 * No second is written beside what is playing. Where something resumes from is
 * a fact the server holds about this viewer, and one kept in the address as
 * well would be a second copy of it — free to disagree, and the one a browser
 * would believe.
 */
const writeLocation = (place: Place): string => {
  if (place.playing !== null) {
    return `/watch/${place.playing}`;
  }

  const query = new URLSearchParams();

  if (place.search !== '') {
    query.set('q', place.search);
  }

  if (place.show !== null) {
    query.set('show', place.show);
  }

  if (place.inspecting !== null) {
    query.set('item', place.inspecting);
  }

  if (place.genre !== null) {
    query.set('genre', place.genre);
  }

  if (place.library !== null) {
    query.set('library', place.library);
  }

  if (place.section === 'admin' && place.adminPanel !== null) {
    query.set('panel', place.adminPanel);
  }

  if (place.section === 'admin' && place.adminJob !== null) {
    query.set('job', place.adminJob);
  }

  const rest = query.toString();

  return `/${place.section === 'home' ? '' : place.section}${rest === '' ? '' : `?${rest}`}`;
};

export type { Place };

export { readLocation, writeLocation, SECTIONS, HOME };
