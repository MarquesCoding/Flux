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
 * It is shown only until somebody has said. After that the window opens on their server and this
 * page is never drawn again.
 */
const Desktop = () => (
  <ConnectToServer
    onConnected={(chosen) => {
      rememberServerAddress(chosen);
      window.flux.goToTheServer();
    }}
  />
);

Desktop.displayName = 'Desktop';

createRoot(container).render(
  <StrictMode>
    <Desktop />
    <Toaster />
  </StrictMode>,
);
