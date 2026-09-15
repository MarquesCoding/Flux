import { collapseToShows } from '@ValenceClient/library/pickFeatured';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { Rail } from '@ValenceClient/library/groupIntoRails';

type HomeRowsInput = {
  resuming: MediaSummary[];
  picked: MediaSummary[];
  recent: MediaSummary[];
  acclaimed: MediaSummary[];
  genres: { genre: string; items: MediaSummary[] }[];
  decades: { decade: number; items: MediaSummary[] }[];
  more: { id: string; title: string; items: MediaSummary[] }[];
};

const ROW_LIMIT = 20;

const MIN_ROW = 4;

/**
 * Drops the second and later appearance of anything, keeping the order it was given in.
 *
 * @param items - What might hold the same thing twice.
 * @returns Each thing once.
 */
const unique = (items: readonly MediaSummary[]): MediaSummary[] => [
  ...new Map(items.map((media) => [media.id, media])).values(),
];

/**
 * One row, or none where there is too little in it to be worth a row of its own.
 *
 * @param id - What the row is known by.
 * @param title - What the row says it is.
 * @param items - What goes in it, best first.
 * @param isCollapsed - Whether a programme's episodes stand as one card for the programme.
 * @param fewest - How few it may hold and still be drawn.
 * @returns The row, or nothing.
 */
const row = (
  id: string,
  title: string,
  items: readonly MediaSummary[],
  isCollapsed = true,
  fewest = MIN_ROW,
): Rail[] => {
  const shown = (isCollapsed ? collapseToShows(unique(items)) : unique(items)).slice(0, ROW_LIMIT);

  return shown.length < fewest ? [] : [{ id, title, items: shown }];
};

/**
 * Names a decade the way somebody says it rather than as the year it happens to start on.
 *
 * @param decade - The year the decade begins.
 * @returns What the row calls itself.
 */
const decadeTitle = (decade: number): string => `From the ${decade.toString()}s`;

/**
 * The rows the front page is browsed by: carrying on, what somebody is likely to want, what is
 * new, what is well thought of, a row for each of a handful of genres, and then the decades the
 * library spans.
 *
 * Every row is bounded, so a server holding six thousand films is still a page of a dozen rows
 * rather than one row six thousand long — the rest is what the sections along the top and search
 * are for. The same film may stand in more than one row, since a thriller that is also new is both.
 * Continue watching keeps each episode as itself, because which episode is the point of it.
 * Recently added is drawn with even one thing in it, since it is the row every library has — a
 * server holding three films would otherwise open on a hero over nothing.
 *
 * @param input - What each row was asked to hold.
 * @returns The rows to draw, in the order they should appear.
 */
const homeRows = ({
  resuming,
  picked,
  recent,
  acclaimed,
  genres,
  decades,
  more,
}: HomeRowsInput): Rail[] => [
  ...row('resume', 'Continue watching', resuming, false, 1),
  ...row('picked', 'Picked for you', picked),
  ...row('recent', 'Recently added', recent, true, 1),
  ...row('acclaimed', 'Critically acclaimed', acclaimed),
  ...genres.flatMap(({ genre, items }) => row(`genre:${genre}`, genre, items)),
  ...decades.flatMap(({ decade, items }) =>
    row(`decade:${decade.toString()}`, decadeTitle(decade), items),
  ),
  ...more.flatMap(({ id, title, items }) => row(id, title, items)),
];

export type { HomeRowsInput };

export { homeRows, ROW_LIMIT, MIN_ROW };
