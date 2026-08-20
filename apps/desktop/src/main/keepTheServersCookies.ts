import { session } from 'electron';
import { asCookiePairs } from '@FluxDesktop/main/asCookiePairs';
import { cookieForRequest } from '@FluxDesktop/main/cookieForRequest';
import { theServerAddress } from '@FluxDesktop/main/theServerAddress';

const SET_COOKIE = 'set-cookie';

/**
 * Keeps the cookies the server sets, in the store the engine itself reads from.
 *
 * A window serving its own pages is a stranger to the server, so a cookie meant for it is a
 * cross-site cookie and the engine will not send one back. It will hold one, though — there is no
 * tracking prevention here — so the cookies are written into its own store with the one attribute
 * changed that stops them being sent, and from then on the engine carries them itself.
 *
 * Written rather than added to the request on its way out, which is what this did first. A header
 * put on a request by hand makes it a request the engine did not make: an ordinary picture stops
 * being an ordinary picture, wants a preflight nobody asked for, and fails as a cross-origin refusal
 * that the server is answering correctly. Letting the engine send its own cookies leaves every
 * request exactly the shape it was.
 *
 * The lifetime the server gave is kept with it, so a session meant to last a week does. Without it
 * every cookie is one the engine drops when the window closes, and somebody is asked to sign in at
 * every launch.
 *
 * Only the server somebody named. A cookie kept from anywhere else belongs to somebody else.
 */
const keepTheServersCookies = (): void => {
  session.defaultSession.webRequest.onHeadersReceived((details, respond) => {
    try {
      const server = theServerAddress();

      if (cookieForRequest(details.url, server, 'held') === null) {
        respond({ responseHeaders: details.responseHeaders });

        return;
      }

      const set = Object.entries(details.responseHeaders ?? {}).find(
        ([name]) => name.toLowerCase() === SET_COOKIE,
      );

      for (const { name, value, expiresAt } of asCookiePairs(set?.[1] ?? [])) {
        void session.defaultSession.cookies.set({
          url: server,
          name,
          value,
          path: '/',
          sameSite: 'no_restriction',
          secure: server.startsWith('https://'),
          ...(expiresAt === null ? {} : { expirationDate: expiresAt }),
        });
      }
    } catch {
      respond({ responseHeaders: details.responseHeaders });

      return;
    }

    respond({ responseHeaders: details.responseHeaders });
  });
};

/**
 * Puts cookies somebody arrived with into the same store.
 *
 * Signing in through a browser leaves the session with the library that fetched it, which holds it
 * for its own requests and knows nothing about the rest of Flux. Handing it to the engine here is
 * what makes it a session for everything else.
 *
 * @param carried - A cookie header, as the library hands one over.
 */
const alsoKeep = (carried: string): void => {
  const server = theServerAddress();

  if (server === '' || carried === '') {
    return;
  }

  for (const { name, value } of asCookiePairs(carried.split(';'))) {
    void session.defaultSession.cookies.set({
      url: server,
      name,
      value,
      path: '/',
      sameSite: 'no_restriction',
      secure: server.startsWith('https://'),
    });
  }
};

export { alsoKeep, keepTheServersCookies };
