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
   * Where to start what is being watched, in seconds.
   */
  startSeconds: number;
};

const HOME: Place = {
  section: 'home',
  search: '',
  inspecting: null,
  show: null,
  playing: null,
  startSeconds: 0,
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
  const started = Number.parseInt(query.get('t') ?? '', 10);

  return {
    section: section.success ? section.data : 'home',
    search: query.get('q') ?? '',
    inspecting: first === 'media' && second !== '' ? second : query.get('item'),
    show: query.get('show'),
    playing: watching,
    startSeconds: Number.isFinite(started) && started > 0 ? started : 0,
  };
};

/**
 * Writes a place back as an address.
 *
 * Watching owns the path, because it is the thing worth sending somebody. An
 * item being read about is a query, since it sits over whatever section it was
 * opened from and should return there when it closes.
 */
const writeLocation = (place: Place): string => {
  if (place.playing !== null) {
    const at = place.startSeconds > 0 ? `?t=${place.startSeconds.toString()}` : '';

    return `/watch/${place.playing}${at}`;
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

  const rest = query.toString();

  return `/${place.section === 'home' ? '' : place.section}${rest === '' ? '' : `?${rest}`}`;
};

export type { Place };

export { readLocation, writeLocation, SECTIONS, HOME };
