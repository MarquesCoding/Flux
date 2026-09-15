import { z } from 'zod';
import { readSearch } from '@ValenceClient/navigation/readSearch';

const ACCOUNT_OPENS_ON = 'profile';

const ADMIN_OPENS_ON = 'overview';

const SECTIONS = [
  'home',
  'shows',
  'films',
  'new',
  'favourites',
  'read',
  'search',
  'account',
  'admin',
] as const;

const SectionSchema = z.enum(SECTIONS);

type Place = {
  section: (typeof SECTIONS)[number];
  search: string;
  isSearchOpen: boolean;
  inspecting: string | null;
  show: string | null;
  person: number | null;
  shareToken: string | null;
  playing: string | null;
  party: string | null;
  genre: string | null;
  library: string | null;
  adminJob: string | null;
  account: string | null;
  admin: string | null;
  downloads: boolean;
};

const HOME: Place = {
  section: 'home',
  search: '',
  isSearchOpen: false,
  inspecting: null,
  show: null,
  person: null,
  shareToken: null,
  playing: null,
  party: null,
  genre: null,
  library: null,
  adminJob: null,
  account: null,
  admin: null,
  downloads: false,
};

/**
 * Reads where the application should be out of a path and whatever sat after the question mark.
 *
 * Anything unrecognised lands on the home page rather than failing: an address is something people
 * edit, share and keep, and a bad one should arrive somewhere sensible.
 *
 * An account, the server and search are dialogs rather than sections, so `/account`, `/admin` and
 * `/search` — which is what Valence used to be and what links people already hold still say —
 * arrive at the home page with the dialog open, rather than at a page that is no longer there.
 *
 * @param pathname - The path, which decides the section and what is playing.
 * @param query - What sat after the question mark, however the router handed it over.
 * @returns Where to be: the section, what is open, and what is playing.
 */
const placeIn = (pathname: string, query: Record<string, string>): Place => {
  const [, first = '', second = ''] = pathname.split('/');
  const section = SectionSchema.safeParse(first);
  const said = readSearch(query);

  return {
    section:
      section.success &&
      section.data !== 'account' &&
      section.data !== 'admin' &&
      section.data !== 'search'
        ? section.data
        : 'home',
    search: said.q ?? '',
    isSearchOpen: said.search === 'open' || first === 'search',
    inspecting: first === 'media' && second !== '' ? second : (said.item ?? null),
    show: said.show ?? null,
    person: said.person ?? null,
    shareToken: first === 'share' && second !== '' ? decodeURIComponent(second) : null,
    playing: first === 'watch' && second !== '' ? second : null,
    party: said.party ?? null,
    genre: said.genre ?? null,
    library: said.library ?? null,
    adminJob: said.job ?? null,
    account: said.account ?? (first === 'account' ? ACCOUNT_OPENS_ON : null),
    admin: said.admin ?? (first === 'admin' ? ADMIN_OPENS_ON : null),
    downloads: said.downloads === 'open' || first === 'downloads',
  };
};

/**
 * Reads where the application should be out of a whole address, for anything holding one rather than
 * a router location.
 *
 * @param url - The address to read.
 * @returns Where to be.
 */
const readLocation = (url: string): Place => {
  const parsed = URL.parse(url);

  if (parsed === null) {
    return HOME;
  }

  return placeIn(parsed.pathname, Object.fromEntries(parsed.searchParams));
};

/**
 * Writes where the application is back as an address. Watching owns the path, since it is the thing
 * worth sending somebody — and a watch party rides beside it, because the party is the thing worth
 * sending when there is one; everything else is a query, since it sits over whatever section it was
 * opened from and should return there when it closes. No second is written beside what is playing —
 * where something resumes from is a fact the server holds, and a copy in the address would be free
 * to disagree with it.
 *
 * @param place - Where the application is.
 * @returns The address to put in the bar.
 */
const writeLocation = (place: Place): string => {
  if (place.shareToken !== null) {
    return `/share/${encodeURIComponent(place.shareToken)}`;
  }

  if (place.playing !== null) {
    return place.party === null
      ? `/watch/${place.playing}`
      : `/watch/${place.playing}?party=${encodeURIComponent(place.party)}`;
  }

  const query = new URLSearchParams();

  if (place.search !== '') {
    query.set('q', place.search);
  }

  if (place.isSearchOpen) {
    query.set('search', 'open');
  }

  if (place.show !== null) {
    query.set('show', place.show);
  }

  if (place.person !== null) {
    query.set('person', place.person.toString());
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

  if (place.account !== null) {
    query.set('account', place.account);
  }

  if (place.admin !== null) {
    query.set('admin', place.admin);
  }

  if (place.downloads) {
    query.set('downloads', 'open');
  }

  if (place.admin !== null && place.adminJob !== null) {
    query.set('job', place.adminJob);
  }

  const rest = query.toString();

  return `/${place.section === 'home' ? '' : place.section}${rest === '' ? '' : `?${rest}`}`;
};

export type { Place };

export { readLocation, placeIn, writeLocation, SECTIONS, HOME, ACCOUNT_OPENS_ON, ADMIN_OPENS_ON };
