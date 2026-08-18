import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Toaster } from '@FluxUI/Toaster';
import { TooltipScope } from '@FluxUI/TooltipScope';
import { buildQueryClient } from '@FluxClient/query/queryClient';
import { installBrowserPlatform } from '@FluxWeb/platform/installBrowserPlatform';
import { buildRouter } from '@FluxScreens/routes/buildRouter';
import './styles/main.css';

installBrowserPlatform();

const container = document.querySelector('#root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html');
}

const answers = buildQueryClient();

const router = buildRouter();

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={answers}>
      <TooltipScope>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipScope>
    </QueryClientProvider>
  </StrictMode>,
);
