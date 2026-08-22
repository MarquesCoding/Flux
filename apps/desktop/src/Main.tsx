import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Toaster } from '@FluxUI/Toaster';
import { TooltipScope } from '@FluxUI/TooltipScope';
import { buildQueryClient } from '@FluxClient/query/queryClient';
import { buildRouter } from '@FluxScreens/routes/buildRouter';
import { ConnectToServer } from '@FluxScreens/components/ConnectToServer/ConnectToServer';
import { WindowBar } from '@FluxScreens/components/WindowBar/WindowBar';
import { whereWeCanGo } from '@FluxScreens/desktop/whereWeCanGo';
import type { WentWhere } from '@FluxScreens/desktop/whereWeCanGo';
import { rememberServerAddress, serverAddress } from '@FluxClient/session/serverAddress';
import { installDesktopPlatform } from '@FluxDesktop/platform/installDesktopPlatform';
import './styles/main.css';
import '@FluxDesktop/TheWindow.types';

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
 * The bar along the top is this client's too, and for the same reason: a browser draws one and a
 * window has to be given one. It sits in the page rather than over it, so every screen below it
 * begins where it ends without having been told a bar exists.
 *
 * The one screen this client owns is the first one: which Valence is yours. It has to be ours, because
 * until it is answered there is no server to ask anything of. What it offers on that screen is found
 * by the process that owns the window — a page served from a scheme of its own cannot go knocking on
 * `localhost` to see what answers, and would be refused for being somebody else's origin.
 */
const Desktop = () => {
  const [server, setServer] = useState(serverAddress());
  const [ahead, setAhead] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [found, setFound] = useState<readonly string[]>(
    () => window.flux.servers?.alreadyFound ?? [],
  );

  useEffect(
    () =>
      router.history.subscribe(({ action }: { action: WentWhere }) => {
        setAhead((was) => whereWeCanGo(was, action));
        setCanGoBack(router.history.canGoBack());
      }),
    [],
  );

  useEffect(
    () =>
      window.flux.servers?.whenFound((address) => {
        setFound((was) => (was.includes(address) ? was : [...was, address]));
      }),
    [],
  );

  return (
    <>
      <WindowBar
        name="Valence"
        canGoBack={canGoBack}
        canGoForward={ahead > 0}
        onBack={() => {
          router.history.back();
        }}
        onForward={() => {
          router.history.forward();
        }}
      />

      {server === null || server === '' ? (
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
