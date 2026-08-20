import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@FluxUI/Toaster';
import { rememberServerAddress } from '@FluxClient/session/serverAddress';
import { ConnectToServer } from '@FluxScreens/components/ConnectToServer/ConnectToServer';
import { installDesktopPlatform } from '@FluxDesktop/platform/installDesktopPlatform';
import './styles/main.css';
import '@FluxDesktop/TheWindow.types';

installDesktopPlatform();

const container = document.querySelector('#root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html');
}

/**
 * The one screen this client ships: which Flux is yours.
 *
 * Everything after it is the Flux running on that server, drawn by that server, because this window
 * loads its pages rather than serving its own. That is what makes signing in, a second factor, a
 * passkey and a saved password all work here exactly as they work in a browser — there is nothing
 * unusual about this client for any of them to trip over.
 *
 * It is shown until somebody has said, and again if the server they named stops answering — a
 * self-hosted server is off sometimes and a laptop is away from it sometimes. Coming back that way
 * arrives with the address already in the box and the reason above it.
 */
const Desktop = () => {
  const unreachable = new URLSearchParams(window.location.search).get('unreachable');

  return (
    <ConnectToServer
      onConnected={(chosen) => {
        rememberServerAddress(chosen);
        window.flux.goToTheServer();
      }}
      {...(unreachable === null ? {} : { startWith: unreachable, couldNotReach: unreachable })}
    />
  );
};

Desktop.displayName = 'Desktop';

createRoot(container).render(
  <StrictMode>
    <Desktop />
    <Toaster />
  </StrictMode>,
);
