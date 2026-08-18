/**
 * How long to remember which guest this is, for a link that admits a set number of people.
 *
 * A guest is recognised by a cookie, and a cookie that lasts only as long as the browser is open
 * means somebody who watched half a film last night arrives this evening as a stranger — and a link
 * meant for one person has no room for a second. The cap counts people, so the thing that says which
 * person somebody is has to outlast an evening.
 *
 * Never longer than the link, though. A guest remembered after the thing identifying them has gone
 * is a cookie with nothing left to say.
 *
 * @param expiresAt - When the link stops working, or nothing where it runs until withdrawn.
 * @param now - The moment being counted from.
 * @param fallbackSeconds - How long to remember somebody holding a link with no end date.
 * @returns How many seconds to keep the cookie for.
 */
const rememberGuestFor = (expiresAt: Date | null, now: Date, fallbackSeconds: number): number => {
  if (expiresAt === null) {
    return fallbackSeconds;
  }

  return Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
};

export { rememberGuestFor };
