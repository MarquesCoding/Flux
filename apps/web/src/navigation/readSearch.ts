import { z } from 'zod';

type PlaceSearch = {
  q: string;
  show: string | null;
  person: number | null;
  item: string | null;
  party: string | null;
  genre: string | null;
  library: string | null;
  panel: string | null;
  job: string | null;
};

const NOTHING: PlaceSearch = {
  q: '',
  show: null,
  person: null,
  item: null,
  party: null,
  genre: null,
  library: null,
  panel: null,
  job: null,
};

const said = z.string().min(1).nullish().catch(null);

const SearchSchema = z.object({
  q: z.string().nullish().catch(null),
  show: said,
  person: z.coerce.number().int().positive().nullish().catch(null),
  item: said,
  party: said,
  genre: said,
  library: said,
  panel: said,
  job: said,
});

/**
 * Reads the part of an address that sits over whatever section it was opened from — what is being
 * searched for, which dialog is open, which panel of the admin page is showing.
 *
 * Anything that will not read is dropped rather than thrown, because an address is something people
 * edit, truncate and paste: `?person=banana` should open no dialog, not fail to load the page. This
 * is where the router validates a search, so it is also the only place that decides what one means.
 *
 * @param raw - What the address carried.
 * @returns What it means, with nothing where it said nothing.
 */
const readSearch = (raw: Record<string, string>): PlaceSearch => {
  const read = SearchSchema.safeParse(raw);

  if (!read.success) {
    return NOTHING;
  }

  const found = read.data;

  return {
    q: found.q ?? '',
    show: found.show ?? null,
    person: found.person ?? null,
    item: found.item ?? null,
    party: found.party ?? null,
    genre: found.genre ?? null,
    library: found.library ?? null,
    panel: found.panel ?? null,
    job: found.job ?? null,
  };
};

export type { PlaceSearch };

export { readSearch };
