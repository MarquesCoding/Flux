import { useCallback } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SplashScreen } from '@FluxUI/SplashScreen';
import { SetupWizard } from '@FluxScreens/components/SetupWizard/SetupWizard';
import { sessionQueries } from '@FluxClient/query/sessionQueries';
import { useFreshFromTheSocket } from '@FluxClient/query/useFreshFromTheSocket';
import type { AppProps } from './App.types';

/**
 * The application itself, at every address: whether this server has been set up, and the page the
 * address in the bar asks for.
 *
 * Setup is decided from what the server reports rather than from anything held here, so a second
 * browser cannot skip it and a stale tab cannot behave as though it is past it.
 *
 * @param initialTitle - What the platform is called, which an operator may have changed.
 */
const App = ({ initialTitle = 'Valence' }: AppProps) => {
  const cache = useQueryClient();

  useFreshFromTheSocket();

  const server = useQuery(sessionQueries.setup());
  const status = server.data ?? null;

  const refresh = useCallback(
    async () => cache.invalidateQueries({ queryKey: sessionQueries.key }),
    [cache],
  );

  if (server.isPending) {
    return <SplashScreen name={initialTitle} label={`Loading ${initialTitle}`} />;
  }

  if (server.isError || status === null) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-2 p-8">
        <h1 className="text-2xl font-semibold text-text">Valence is not reachable</h1>
        <p className="text-text-muted">
          The server did not respond. Check that it is running and reload the page.
        </p>
      </main>
    );
  }

  if (!status.isComplete) {
    return (
      <SetupWizard
        status={status}
        onComplete={() => {
          void refresh();
        }}
      />
    );
  }

  return <Outlet />;
};

App.displayName = 'App';

export { App };
