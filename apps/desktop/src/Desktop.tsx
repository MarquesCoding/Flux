import { useEffect, useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { buildRouter } from '@ValenceScreens/routes/buildRouter';
import { ConnectToServer } from '@ValenceScreens/components/ConnectToServer/ConnectToServer';
import { useAppliedTheme } from '@ValenceScreens/theme/useAppliedTheme';
import { WindowBar } from '@ValenceScreens/components/WindowBar/WindowBar';
import { rememberServerAddress, serverAddress } from '@ValenceClient/session/serverAddress';
import { useServerIsLost } from '@ValenceClient/offline/useServerIsLost';
import '@ValenceDesktop/TheWindow.types';

const router = buildRouter('Valence');

/**
 * Valence, drawn by this client rather than fetched from a server as pages.
 *
 * The application is a package and this is a host for it — the same one the browser is, with
 * different answers to the four things a host is asked: where preferences live, what to call this
 * client, which client this is, and how to open a socket. Everything above that is the same code
 * running in both places.
 *
 * What a server is asked for goes out on this client's own origin and is passed on by the process
 * that owns the window. So nothing here is cross-origin, no cookie is dropped for being somebody
 * else's, and signing in is an ordinary request rather than a negotiation between two origins.
 *
 * The strip along the top is this client's too, and for the same reason: a browser gives a window
 * somewhere to be picked up by and a frameless one has nowhere. It draws nothing and lies over the
 * page rather than above it, so no screen pays height for a bar it never sees.
 *
 * The one screen this client owns is the first one: which Valence is yours. It has to be ours, because
 * until it is answered there is no server to ask anything of. Nothing else is drawn until it is
 * answered — a client with no server has no library, no account and no downloads, and the shelf of
 * downloads in particular is an empty room on a machine that has never been given anywhere to fetch
 * from. What it offers on that screen is found by the process that owns the window — a page served
 * from a scheme of its own cannot go knocking on `localhost` to see what answers, and would be
 * refused for being somebody else's origin. Where nothing is found it is the same screen with the
 * box alone, because somebody whose server is on another machine still has to be asked.
 *
 * An address that no longer answers is asked about again, but only where there is nothing on this
 * device. Offline mode is built around a shelf of downloads, and offering it an empty shelf is
 * showing somebody an empty room and calling it a feature — the honest question at that point is
 * where Valence went, not which of the nothing they would like to watch. Somebody who does have
 * downloads keeps them, because a laptop on a plane has not mistyped its address.
 *
 * That question is followed rather than asked once. A client that has made no request yet has no
 * grounds to call its server missing, so it starts out assuming one is there and learns otherwise
 * from the first request that fails — which is after this has been drawn. Reading it as the window
 * opens therefore only ever read back the assumption, and an address that was dead all along drew
 * the empty shelf anyway.
 *
 * Whoever is asked again is shown the address that stopped answering rather than an empty box. They
 * came here to correct a detail or to wait for a machine to come back, not to remember what they
 * typed months ago.
 *
 * The chosen theme is put on the document from here as well as from the application's own root,
 * because the screen this client owns is drawn instead of that root rather than inside it.
 */
const Desktop = () => {
  const [server, setServer] = useState(serverAddress());
  const [found, setFound] = useState<readonly string[]>(
    () => window.valence.servers?.alreadyFound ?? [],
  );
  const isLost = useServerIsLost();

  useAppliedTheme();

  useEffect(
    () =>
      window.valence.servers?.whenFound((address) => {
        setFound((was) => (was.includes(address) ? was : [...was, address]));
      }),
    [],
  );

  const chosen = server === null || server === '' ? null : server;

  return (
    <>
      <WindowBar />

      {chosen === null || isLost ? (
        <ConnectToServer
          found={found}
          {...(chosen === null ? {} : { startWith: chosen, couldNotReach: chosen })}
          onConnected={(address) => {
            rememberServerAddress(address);
            setServer(address);
          }}
        />
      ) : (
        <RouterProvider router={router} />
      )}
    </>
  );
};

Desktop.displayName = 'Desktop';

export { Desktop };
