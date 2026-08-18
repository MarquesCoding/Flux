import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeClient } from '@FluxClient/realtime/getRealtimeClient';
import { libraryQueries } from '@FluxClient/query/libraryQueries';
import { notificationQueries } from '@FluxClient/query/notificationQueries';
import { sessionQueries } from '@FluxClient/query/sessionQueries';
import { adminQueries } from '@FluxClient/query/adminQueries';
import type { RealtimeClient } from '@FluxClient/realtime/createRealtimeClient';

type SaysWhatChanged = Pick<RealtimeClient, 'subscribe' | 'onResumed'>;

/**
 * Throws away what the server has just said is out of date.
 *
 * A cache is only as good as the moment it stops trusting itself, and the usual answer — a timer
 * that guesses — is the wrong one here: this application already holds a socket that says when the
 * library was scanned, when a notification arrived, when somebody's permissions changed. Being told
 * beats guessing, so the socket does the invalidating and the polling intervals go.
 *
 * A reconnection invalidates everything, because a tab that was asleep missed whatever happened
 * while it was gone and has no way to find out what.
 *
 * @param client - Whatever says what changed, which is the shared socket.
 */
const useFreshFromTheSocket = (client: SaysWhatChanged = getRealtimeClient()): void => {
  const cache = useQueryClient();

  useEffect(() => {
    const stopWatching = [
      client.subscribe('media', () => {
        void cache.invalidateQueries({ queryKey: libraryQueries.key });
      }),

      client.subscribe('notifications', () => {
        void cache.invalidateQueries({ queryKey: notificationQueries.key });
      }),

      client.subscribe('profile', () => {
        void cache.invalidateQueries({ queryKey: sessionQueries.key });
      }),

      client.subscribe('sessions', () => {
        void cache.invalidateQueries({ queryKey: adminQueries.key });
      }),

      client.onResumed(() => {
        void cache.invalidateQueries();
      }),
    ];

    return () => {
      for (const stop of stopWatching) {
        stop();
      }
    };
  }, [cache, client]);
};

export { useFreshFromTheSocket };
