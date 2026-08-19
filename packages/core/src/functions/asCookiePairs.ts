type CookiePair = { name: string; value: string };

/**
 * Reads a list of `name=value` texts into pairs, dropping anything that is not one.
 *
 * Written once because three places need it and they are not the same place: the server reads what
 * it is about to set, the server reads what a client handed back, and a client merges the two. All
 * three are looking at the same shape — the body of a `Cookie` header, or the first part of a
 * `Set-Cookie` one — and none of them wants the attributes that may follow.
 *
 * The value is taken from the first `=` onwards and is otherwise left exactly as it was found. A
 * signed cookie carries `.` and base64url in it, and anything that rewrites it stops it verifying.
 *
 * @param texts - The `name=value` texts, in any order.
 * @returns The pairs, in the order they were given.
 */
const asCookiePairs = (texts: readonly string[]): CookiePair[] =>
  texts
    .map((text) => text.trim())
    .filter((text) => text.indexOf('=') > 0)
    .map((text) => ({
      name: text.slice(0, text.indexOf('=')),
      value: text.slice(text.indexOf('=') + 1),
    }));

export type { CookiePair };

export { asCookiePairs };
