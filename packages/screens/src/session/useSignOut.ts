import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notify } from '@ValenceUI/notify';
import { signOut } from '@ValenceClient/session/auth';
import { useShell } from '@ValenceClient/shell/useShell';
import { usePlace } from '@ValenceScreens/navigation/usePlace';

/**
 * Ends the session and puts the app back at the way in, from anywhere that offers to — the account
 * dialog and the menu on the bar's face both do, and must leave the same way.
 *
 * Signing out empties the cache rather than only asking who is signed in again. Everything held
 * there belongs to the person leaving — what they kept, how far through things they are, what is
 * waiting on their bell — and handing that to whoever signs in next is a privacy fault, not a stale
 * read.
 *
 * @returns Signs out.
 */
const useSignOut = (): (() => Promise<void>) => {
  const { refresh } = useShell();
  const { go } = usePlace();
  const cache = useQueryClient();

  return useCallback(async () => {
    const ended = await signOut();

    if (!ended) {
      notify.failed('You are still signed in. The server would not end the session.');

      return;
    }

    cache.clear();
    go({
      section: 'home',
      search: '',
      inspecting: null,
      playing: null,
      account: null,
      admin: null,
    });

    await refresh();
  }, [cache, go, refresh]);
};

export { useSignOut };
