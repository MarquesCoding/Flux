import { createAuthClient } from 'better-auth/client';
import { electronClient } from '@better-auth/electron/client';
import { storage } from '@better-auth/electron/storage';
import { onTheServer, PLACEHOLDER_ORIGIN } from '@FluxCore/functions/onTheServer';
import { DESKTOP_SCHEME } from '@FluxCore/functions/desktopScheme';
import { theServerAddress } from '@FluxDesktop/main/theServerAddress';
import { whereToSignIn } from '@FluxDesktop/main/whereToSignIn';

const askTheServer = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const asked = input instanceof Request ? input.url : String(input);

  return globalThis.fetch(onTheServer(theServerAddress(), asked), init);
};

/**
 * The one thing in this process that holds a session.
 *
 * Somebody signs in through their own browser, on the server's own pages, where a cookie is a cookie
 * and a second factor and a passkey work as they always have. What comes back to this process is an
 * authorization code, exchanged here for a session that lives here. The window never sees it.
 *
 * Nobody has said where their Flux is the first time this runs, and the library copies its options
 * when it is built, so an address read here is the address it keeps forever. `signInURL` is
 * therefore an object that is changed in place rather than a string that was read, and every request
 * has its path lifted onto whatever address is current — the same trick the window plays, for the
 * same reason.
 *
 * @returns The client.
 */
const theDesktopsAuth = () =>
  createAuthClient({
    baseURL: PLACEHOLDER_ORIGIN,
    basePath: '/api/auth',
    fetchOptions: { customFetchImpl: askTheServer },
    plugins: [
      electronClient({
        signInURL: whereToSignIn(),
        protocol: DESKTOP_SCHEME,
        storage: storage(),
      }),
    ],
  });

export { theDesktopsAuth };
