import { z } from 'zod';

type PlaceSearch = {
  q?: string;
  search?: string;
  show?: string;
  person?: number;
  item?: string;
  party?: string;
  genre?: string;
  library?: string;
  panel?: string;
  job?: string;
  account?: string;
  admin?: string;
  downloads?: string;
};

const NOTHING: PlaceSearch = {};

const said = z.string().min(1).nullish().catch(null);

const SearchSchema = z.object({
  q: z.string().nullish().catch(null),
  search: said,
  show: said,
  person: z.coerce.number().int().positive().nullish().catch(null),
  item: said,
  party: said,
  genre: said,
  library: said,
  panel: said,
  job: said,
  account: said,
  admin: said,
  downloads: said,
});

/**
 * Reads the part of an address that sits over whatever section it was opened from — what is being
 * searched for, which dialog is open, which panel of the admin page is showing.
 *
 * Anything that will not read is dropped rather than thrown, because an address is something people
 * edit, truncate and paste: `?person=banana` should open no dialog, not fail to load the page. This
 * is where the router validates a search, so it is also the only place that decides what one means.
 *
 * What was not said is left out rather than answered with nothing, because the router writes this
 * back to the address bar: an answer of `null` becomes `?party=null` in somebody's address.
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

  const said: PlaceSearch = {};

  for (const [name, value] of Object.entries(found)) {
    if (value !== null && value !== undefined) {
      Object.assign(said, { [name]: value });
    }
  }

  return said;
};

export type { PlaceSearch };

export { readSearch };
