const GONE = /(^|;)\s*(max-age\s*=\s*0|expires\s*=\s*thu,\s*01\s*jan\s*1970)/i;

type CookieJar = {
  keep: (lines: readonly string[]) => void;
  carried: () => string;
  empty: () => void;
};

/**
 * Holds the cookies the server sets, on behalf of a window that cannot hold them itself.
 *
 * A window serving its own pages is a stranger to the server: a browser engine will not keep a
 * cookie it is sent from somewhere else, and a script cannot read or write one. Out here neither
 * rule applies — a response is a response and a request is a request — so signing in works exactly
 * as it does in a browser, including a second factor, because the cookie the challenge is carried in
 * is kept like any other.
 *
 * Kept in memory rather than on disk. A session that outlives the application is a session somebody
 * did not ask to leave lying about, and signing in again is one screen.
 *
 * @returns The jar.
 */
const theCookieJar = (): CookieJar => {
  const held = new Map<string, string>();

  return {
    keep: (lines) => {
      for (const line of lines) {
        const pair = line.split(';')[0] ?? '';
        const at = pair.indexOf('=');

        if (at <= 0) {
          continue;
        }

        const name = pair.slice(0, at).trim();
        const value = pair.slice(at + 1).trim();

        if (value === '' || GONE.test(line)) {
          held.delete(name);
        } else {
          held.set(name, value);
        }
      }
    },
    carried: () => [...held].map(([name, value]) => `${name}=${value}`).join('; '),
    empty: () => {
      held.clear();
    },
  };
};

export type { CookieJar };

export { theCookieJar };
