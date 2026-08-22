import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { buildRouter } from '@ValenceScreens/routes/buildRouter';
import type { RenderResult } from '@testing-library/react';

/**
 * Renders the whole application at whatever address the bar already says.
 *
 * The application is a tree of routes rather than one component, so a test that wants to know how it
 * behaves has to mount the router that draws it. A fresh cache and a fresh router each time, so that
 * nothing a test sees was answered from what an earlier one asked for.
 *
 * @param title - What this instance is called, where a test cares.
 * @returns Whatever `render` returns.
 */
const renderTheApp = (title?: string): RenderResult => {
  const answers = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={answers}>
      <RouterProvider router={buildRouter(title)} />
    </QueryClientProvider>,
  );
};

export { renderTheApp };
