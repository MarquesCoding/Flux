import { QueryClient } from '@tanstack/react-query';

const STALE_FOR_MS = 60_000;

const KEPT_FOR_MS = 10 * 60_000;

const TRIES = 2;

/**
 * Builds the one cache the application answers from.
 *
 * The defaults are the whole argument for having it. An answer is treated as fresh for a minute, so
 * moving between pages shows what is already known instead of asking again and waiting — which is
 * the bug that produced a splash screen between every page and a hand-written cache to hide it. It
 * is kept for ten minutes after nothing is looking at it, so a viewer who wanders off and comes back
 * finds the library where they left it.
 *
 * Being stale means asking again, not showing nothing. Every screen renders the last answer and
 * replaces it when a better one arrives, which is why there is no waiting state to design.
 *
 * Two tries rather than the library's three: a self-hosted server on the same network either answers
 * or is down, and a third attempt mostly delays telling the viewer so.
 *
 * @returns The cache, ready to be handed to the application.
 */
const buildQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_FOR_MS,
        gcTime: KEPT_FOR_MS,
        retry: TRIES,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });

export { buildQueryClient, STALE_FOR_MS, KEPT_FOR_MS };
