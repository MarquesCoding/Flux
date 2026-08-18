import { useQueryClient } from '@tanstack/react-query';
import { notify } from '@FluxUI/notify';
import { AccountArea } from '@FluxScreens/components/AccountArea/AccountArea';
import { signOut } from '@FluxClient/session/auth';
import { usePlace } from '@FluxScreens/navigation/usePlace';
import { useShell } from '@FluxClient/shell/useShell';

/**
 * This account: who it is, how it signs in, what it is signed in on, and what it has watched.
 *
 * Signing out empties the cache rather than only asking who is signed in again. Everything held
 * there belongs to the person leaving — what they kept, how far through things they are, what is
 * waiting on their bell — and handing that to whoever signs in next is a privacy fault, not a stale
 * read.
 */
const AccountPage = () => {
  const { user, refresh } = useShell();
  const { go } = usePlace();
  const cache = useQueryClient();

  return (
    <AccountArea
      user={user}
      onChanged={() => {
        void refresh();
      }}
      onSignOut={() => {
        void signOut().then(async (ended) => {
          if (!ended) {
            notify.failed('You are still signed in. The server would not end the session.');

            return;
          }

          cache.clear();
          go({ section: 'home', search: '', inspecting: null, playing: null });

          return refresh();
        });
      }}
    />
  );
};

AccountPage.displayName = 'AccountPage';

export { AccountPage };
