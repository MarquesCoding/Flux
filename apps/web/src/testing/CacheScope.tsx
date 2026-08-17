import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterContextProvider } from '@tanstack/react-router';
import { buildRouter } from '@FluxWeb/routes/buildRouter';
import type { CacheScopeProps } from './CacheScope.types';

/**
 * Holds a cache and a router for whatever is rendered inside it, both made fresh each time.
 *
 * A component holding its own state can be rendered on its own; one reading the shared cache or the
 * address cannot, because both are providers it expects somebody above it to have mounted. New ones
 * per mount rather than shared between them, so that what a test asks for is never answered from
 * what an earlier test asked for, and retries do not turn a deliberate failure into a wait.
 *
 * The router is given the same addresses the application serves and the browser's own history, so a
 * test that puts something in the address bar before rendering is read exactly as a reload would
 * read it. It holds the router rather than drawing through it, because what a test renders is what
 * it asked for rather than whatever the address matched.
 *
 * @param children - What is being tested.
 */
const CacheScope = ({ children }: CacheScopeProps) => {
  const [answers] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 0, gcTime: Infinity },
          mutations: { retry: false },
        },
      }),
  );

  const [router] = useState(() => buildRouter(() => null));

  return (
    <QueryClientProvider client={answers}>
      <RouterContextProvider router={router}>{children}</RouterContextProvider>
    </QueryClientProvider>
  );
};

CacheScope.displayName = 'CacheScope';

export { CacheScope };
