import { session } from 'electron';
import { cookieForRequest } from '@FluxDesktop/main/cookieForRequest';
import { theServerAddress } from '@FluxDesktop/main/theServerAddress';

type Held = { getCookie: () => string };

/**
 * Puts the session on every request the window makes to the server, including the ones it cannot
 * make itself.
 *
 * A page can set a header on a `fetch` and cannot set one on a `<video>`, which is what fetches every
 * segment of everything anybody watches. Out here there is no such distinction: a request is a
 * request on its way out, and this is the only place that sees all of them.
 *
 * Every path through here answers, including the ones that went wrong. Electron holds a request open
 * until this callback replies, so a throw on the way to signing one request does not fail that
 * request — it hangs it, and every other, for as long as the application runs. A window where
 * nothing at all happens and nothing is reported is the worst way for this to break, and it is the
 * cheapest to prevent: a request that could not be signed still goes, and either the server refuses
 * it or nobody needed the session for it.
 *
 * @param held - Whatever is holding the session, asked afresh each time rather than read once.
 */
const carryTheSession = (held: Held): void => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, respond) => {
    try {
      const carried = cookieForRequest(details.url, theServerAddress(), held.getCookie());

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

export { carryTheSession };
