import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Toaster } from '@FluxUI/Toaster';
import { TooltipScope } from '@FluxUI/TooltipScope';
import { buildQueryClient } from '@FluxClient/query/queryClient';
import { rememberServerAddress, serverAddress } from '@FluxClient/session/serverAddress';
import { ConnectToServer } from '@FluxScreens/components/ConnectToServer/ConnectToServer';
import { buildRouter } from '@FluxScreens/routes/buildRouter';
import { installDesktopPlatform } from '@FluxDesktop/platform/installDesktopPlatform';
import './styles/main.css';

await installDesktopPlatform();

const container = document.querySelector('#root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html');
}

const answers = buildQueryClient();

const router = buildRouter('Flux');

/**
 * Draws the application, or asks which Flux it is for where nobody has said yet.
 *
 * A browser is never asked, so `apps/web` mounts the router and nothing else. A desktop client
 * serves its own pages and cannot know, so the address is the one thing it needs before anything
 * else will work — every request and every picture is built onto it.
 */
const Desktop = () => {
  const [address, setAddress] = useState(serverAddress());

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
