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
 * @param held - Whatever is holding the session, asked afresh each time rather than read once.
 */
const carryTheSession = (held: Held): void => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, respond) => {
    const carried = cookieForRequest(details.url, theServerAddress(), held.getCookie());

    if (carried === null) {
      respond({ requestHeaders: details.requestHeaders });

      return;
    }

    respond({ requestHeaders: { ...details.requestHeaders, Cookie: carried } });
  });
};

export { carryTheSession };
