import { QueryCache, QueryClient } from '@tanstack/react-query';
import { RequestFailed } from '@FluxClient/query/RequestFailed';
import { sessionQueries } from '@FluxClient/query/sessionQueries';

const STALE_FOR_MS = 60_000;

const KEPT_FOR_MS = 10 * 60_000;

const TRIES = 2;

const REFUSED = 401;

const SETTLED = new Set([400, 401, 403, 404, 405, 409, 422]);

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
 * or is down, and a third attempt mostly delays telling the viewer so. A refusal the server has
 * already made up its mind about is not tried again at all — asking a second time for something it
 * will not give delays the answer without changing it.
 *
 * A refused session is answered here rather than by each caller. Being signed out shows up as a 401
 * on whatever happened to be read next, and absorbing that one panel at a time is how a page comes
 * to look signed in — name, face and all, from a cached answer — while every request behind it is
 * being turned away. Re-reading who is signed in is enough: it comes back as nobody, and the
 * application shows the way in. Only that key is dropped, so the read that failed is not immediately
 * made again against the same refusal.
 *
 * @returns The cache, ready to be handed to the application.
 */
const buildQueryClient = (): QueryClient => {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof RequestFailed && error.status === REFUSED) {
          void client.invalidateQueries({ queryKey: sessionQueries.who().queryKey });
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_FOR_MS,
        gcTime: KEPT_FOR_MS,
        retry: (failureCount, error) =>
          !(error instanceof RequestFailed && SETTLED.has(error.status)) && failureCount < TRIES,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  return client;
};

export { buildQueryClient, STALE_FOR_MS, KEPT_FOR_MS };
