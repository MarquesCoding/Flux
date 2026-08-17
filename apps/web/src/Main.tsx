import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@FluxUI/Toaster';
import { TooltipScope } from '@FluxUI/TooltipScope';
import { App } from './components/App/App';
import './styles/main.css';

const container = document.querySelector('#root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <TooltipScope>
      <App />
      <Toaster />
    </TooltipScope>
  </StrictMode>,
);
