import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Toaster } from '@ValenceUI/Toaster';
import { TooltipScope } from '@ValenceUI/TooltipScope';
import { buildQueryClient } from '@ValenceClient/query/queryClient';
import { buildRouter } from '@ValenceScreens/routes/buildRouter';
import { ConnectToServer } from '@ValenceScreens/components/ConnectToServer/ConnectToServer';
import { WindowBar } from '@ValenceScreens/components/WindowBar/WindowBar';
import { rememberServerAddress, serverAddress } from '@ValenceClient/session/serverAddress';
import { installDesktopPlatform } from '@ValenceDesktop/platform/installDesktopPlatform';
import './styles/main.css';
import '@ValenceDesktop/TheWindow.types';

installDesktopPlatform();

const container = document.querySelector('#root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html');
}

const answers = buildQueryClient();

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
 * until it is answered there is no server to ask anything of. What it offers on that screen is found
 * by the process that owns the window — a page served from a scheme of its own cannot go knocking on
 * `localhost` to see what answers, and would be refused for being somebody else's origin.
 *
 * An address that no longer answers is asked about again, but only where there is nothing on this
 * device. Offline mode is built around a shelf of downloads, and offering it an empty shelf is
 * showing somebody an empty room and calling it a feature — the honest question at that point is
 * where Valence went, not which of the nothing they would like to watch. Somebody who does have
 * downloads keeps them, because a laptop on a plane has not mistyped its address.
 */
const Desktop = () => {
  const [server, setServer] = useState(serverAddress());
  const [found, setFound] = useState<readonly string[]>(
    () => window.valence.servers?.alreadyFound ?? [],
  );
  const [hasNothingHeld, setHasNothingHeld] = useState(false);

  useEffect(
    () =>
      window.valence.servers?.whenFound((address) => {
        setFound((was) => (was.includes(address) ? was : [...was, address]));
      }),
    [],
  );

  useEffect(() => {
    if (window.valence.reach.now()) {
      return;
    }

    void window.valence.held.all().then((kept) => {
      setHasNothingHeld(Array.isArray(kept) && kept.length === 0);
    });
  }, []);

  return (
    <>
      <WindowBar />

      {server === null || server === '' || hasNothingHeld ? (
        <ConnectToServer
          found={found}
          onConnected={(chosen) => {
            rememberServerAddress(chosen);
            setServer(chosen);
          }}
        />
      ) : (
        <RouterProvider router={router} />
      )}
    </>
  );
};

Desktop.displayName = 'Desktop';

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={answers}>
      <TooltipScope>
        <Desktop />
        <Toaster />
      </TooltipScope>
    </QueryClientProvider>
  </StrictMode>,
);
