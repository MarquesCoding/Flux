import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@FluxUI/Toaster';
import { TooltipScope } from '@FluxUI/TooltipScope';
import { buildQueryClient } from '@FluxWeb/query/queryClient';
import { App } from './components/App/App';
import './styles/main.css';

const container = document.querySelector('#root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html');
}

const answers = buildQueryClient();

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={answers}>
      <TooltipScope>
        <App />
        <Toaster />
      </TooltipScope>
    </QueryClientProvider>
  </StrictMode>,
);
