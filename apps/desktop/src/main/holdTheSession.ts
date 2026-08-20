import { session } from 'electron';
import { cookieForRequest } from '@FluxDesktop/main/cookieForRequest';
import { theCookieJar } from '@FluxDesktop/main/theCookieJar';
import { theServerAddress } from '@FluxDesktop/main/theServerAddress';

const SET_COOKIE = 'set-cookie';

type Held = { getCookie: () => string };

/**
 * Signs somebody in inside this window, by keeping the cookies the server sets and sending them back.
 *
 * A window serving its own pages is a stranger to the server, so a browser engine will neither keep
 * a cookie it is sent nor let a script hold one, and a `<video>` element's requests can be given a
 * header by nobody at all. None of that is true out here. Watching what the server sets and putting
 * it back on the way out is the whole of it, and it makes the way in the same one the browser uses —
 * the wall of faces, a PIN, a second factor — with nothing rebuilt and nothing relayed.
 *
 * Only the server somebody named, in both directions. A credential sent to a host that did not ask
 * for it is a credential given away, and a cookie kept from one is a stranger's cookie.
 *
 * Two ways in, one way out. Signing in here fills the jar; signing in through a browser leaves the
 * session with the library that fetched it, which knows how to authenticate its own requests and
 * nothing about the rest of Flux. So where the jar is empty the library is asked instead, and either
 * way every request leaves signed. Without that, a browser sign-in worked perfectly and the
 * application it returned to stayed logged out.
 *
 * Every path answers, including the ones that went wrong. Electron holds a request open until this
 * replies, so a throw here does not fail one request, it hangs every request for as long as the
 * application runs.
 *
 * @param held - The library holding a session got through a browser.
 */
const holdTheSession = (held: Held): void => {
  const jar = theCookieJar();
  const { webRequest } = session.defaultSession;

  webRequest.onHeadersReceived((details, respond) => {
    try {
      const mine = cookieForRequest(details.url, theServerAddress(), 'held');
      const set = Object.entries(details.responseHeaders ?? {}).find(
        ([name]) => name.toLowerCase() === SET_COOKIE,
      );

      if (mine !== null && set !== undefined) {
        jar.keep(set[1]);
      }
    } catch {
      respond({ responseHeaders: details.responseHeaders });

      return;
    }

    respond({ responseHeaders: details.responseHeaders });
  });

  webRequest.onBeforeSendHeaders((details, respond) => {
    try {
      const mine = jar.carried();
      const carried = cookieForRequest(
        details.url,
        theServerAddress(),
        mine === '' ? held.getCookie() : mine,
      );

      respond({
        requestHeaders:
          carried === null
            ? details.requestHeaders
            : { ...details.requestHeaders, Cookie: carried },
      });
    } catch {
      respond({ requestHeaders: details.requestHeaders });
    }
  });
};

export { holdTheSession };
