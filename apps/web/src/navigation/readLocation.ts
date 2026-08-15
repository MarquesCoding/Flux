import { z } from 'zod';

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

type Place = {
  section: (typeof SECTIONS)[number];
  search: string;
  inspecting: string | null;
  show: string | null;
  playing: string | null;
  genre: string | null;
  library: string | null;
  adminPanel: string | null;
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
