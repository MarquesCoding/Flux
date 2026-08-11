/**
 * The longest a name is allowed to be once it is an address.
 *
 * Long enough for any title somebody would say out loud, short enough that a
 * link can be read over the phone.
 */
const LONGEST = 80

/**
 * What a series is called, as an address.
 *
 * A show is not a row in a table — it is every file that names the same
 * series — so it has no identifier of its own to be named by. Its title is the
 * only thing it has, and this is that title made safe to put in a URL and
 * stable enough to bookmark.
 *
 * Case and punctuation are dropped rather than encoded, so `A Sign of
 * Affection` and `a sign of affection!` are one show, which is what somebody
 * looking at a shelf would say too.
 */
const showSlug = (seriesTitle: string): string =>
  seriesTitle
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LONGEST)

export default { showSlug, LONGEST }
