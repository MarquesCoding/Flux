import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Toaster } from '@FluxUI/Toaster';
import { TooltipScope } from '@FluxUI/TooltipScope';
import { buildQueryClient } from '@FluxClient/query/queryClient';
import { rememberServerAddress, serverAddress } from '@FluxClient/session/serverAddress';
import { sessionQueries } from '@FluxClient/query/sessionQueries';
import { ConnectToServer } from '@FluxScreens/components/ConnectToServer/ConnectToServer';
import { SignInThroughYourBrowser } from '@FluxScreens/components/SignInThroughYourBrowser/SignInThroughYourBrowser';
import { buildRouter } from '@FluxScreens/routes/buildRouter';
import { installDesktopPlatform } from '@FluxDesktop/platform/installDesktopPlatform';
import './styles/main.css';
import '@FluxDesktop/TheWindow.types';

installDesktopPlatform();

const container = document.querySelector('#root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html');
}

const answers = buildQueryClient();

const router = buildRouter('Flux');

/**
 * Draws the application, or the one thing standing before it.
 *
 * Three states, in order, and each is a thing a browser never has to ask. Which Flux is this for —
 * a browser is answered by the page it was served. Who is watching — a browser signs somebody in
 * where they already are, and this window cannot hold the cookie that would take. Then the
 * application, which from here on is the same code the browser runs.
 */
const Desktop = () => {
  const cache = useQueryClient();
  const [address, setAddress] = useState(serverAddress());
  const session = useQuery({ ...sessionQueries.who(), enabled: address !== null });

  const startAgain = useCallback(() => {
    rememberServerAddress(null);
    setAddress(null);
  }, []);

  const signedIn = useCallback(() => {
    void cache.invalidateQueries({ queryKey: sessionQueries.who().queryKey });
  }, [cache]);

  if (address === null) {
    return (
      <ConnectToServer
        onConnected={(chosen) => {
          rememberServerAddress(chosen);
          setAddress(chosen);
        }}
      />
    );
  }

  if (session.isPending) {
    return null;
  }

  if (session.data === null || session.data === undefined) {
    return <SignInThroughYourBrowser onSignedIn={signedIn} onChangeServer={startAgain} />;
  }

  return <RouterProvider router={router} />;
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
