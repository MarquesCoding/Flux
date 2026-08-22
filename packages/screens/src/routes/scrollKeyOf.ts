const KEPT_IN_PLACE = [
  'item',
  'show',
  'person',
  'party',
  'account',
  'admin',
  'job',
  'library',
] as const;

/**
 * Says which address a remembered scroll position belongs to, treating the parts of the address
 * that only raise something over the page as though they were not there.
 *
 * A dialog is an address here rather than a piece of local state, so opening one is a navigation.
 * The router remembers scroll against each address it has seen and has nothing remembered for an
 * address it has not, so it does what a browser does with a new page and goes to the top. Behind an
 * open dialog nobody sees that happen; on dismissal the page is revealed already at the top, which
 * reads as the dialog having thrown the reader back to the start.
 *
 * Removing those parts leaves the page either side of a dialog sharing one key, so there is nothing
 * to restore and the page does not move. Everything that genuinely replaces what is on the page —
 * the search text, the genre, the admin panel — still counts as somewhere else.
 *
 * The library is in the list for a different reason. It does change what is on the page, but it is
 * chosen from a control part-way down it, and being thrown to the top on every press makes picking
 * between libraries feel like leaving the page and coming back to it. Choosing what to look at
 * should leave you where you were looking from.
 *
 * @param pathname - The path the router is on.
 * @param searchStr - The query it is on, leading question mark and all.
 * @returns The key to remember and restore scroll against.
 */
const scrollKeyOf = ({ pathname, searchStr }: { pathname: string; searchStr: string }): string => {
  const query = new URLSearchParams(searchStr);

  for (const kept of KEPT_IN_PLACE) {
    query.delete(kept);
  }

  const rest = query.toString();

  return rest === '' ? pathname : `${pathname}?${rest}`;
};

export { scrollKeyOf };
