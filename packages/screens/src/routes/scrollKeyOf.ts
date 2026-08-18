const OVERLAYS = ['item', 'show', 'person', 'party'] as const;

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
 * to restore and the page does not move. Everything that genuinely changes what is on the page —
 * the search text, the genre, the library, the admin panel — still counts as somewhere else.
 *
 * @param pathname - The path the router is on.
 * @param searchStr - The query it is on, leading question mark and all.
 * @returns The key to remember and restore scroll against.
 */
const scrollKeyOf = ({ pathname, searchStr }: { pathname: string; searchStr: string }): string => {
  const query = new URLSearchParams(searchStr);

  for (const overlay of OVERLAYS) {
    query.delete(overlay);
  }

  const rest = query.toString();

  return rest === '' ? pathname : `${pathname}?${rest}`;
};

export { scrollKeyOf };
