import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type { RenderOptions, RenderResult } from '@testing-library/react';

/**
 * Renders something that asks the cache questions, and gives it a cache of its own.
 *
 * A component holding its own state can be rendered on its own; one reading a shared cache cannot,
 * because the cache is a provider it expects somebody above it to have mounted. A fresh one per
 * render rather than a shared one, so that what a test asks for is never answered from what an
 * earlier test asked for, and so retries do not turn a deliberate failure into a three-second wait.
 *
 * @param ui - What to render.
 * @param options - Anything else Testing Library takes.
 * @returns Whatever `render` returns.
 */
const renderInACache = (ui: ReactElement, options?: RenderOptions): RenderResult => {
  const answers = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  const CacheScope = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={answers}>{children}</QueryClientProvider>
  );

  CacheScope.displayName = 'CacheScope';

  return render(ui, { wrapper: CacheScope, ...options });
};

export { renderInACache };
