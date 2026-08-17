import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CacheScopeProps } from './CacheScope.types';

/**
 * Holds a cache for whatever is rendered inside it, made fresh each time.
 *
 * A component holding its own state can be rendered on its own; one reading the shared cache cannot,
 * because the cache is a provider it expects somebody above it to have mounted. A new one per mount
 * rather than one shared between them, so that what a test asks for is never answered from what an
 * earlier test asked for, and retries do not turn a deliberate failure into a three-second wait.
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

  return <QueryClientProvider client={answers}>{children}</QueryClientProvider>;
};

CacheScope.displayName = 'CacheScope';

export { CacheScope };
