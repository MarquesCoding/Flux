import { AccountArea } from '@FluxWeb/components/AccountArea/AccountArea';
import { signOut } from '@FluxWeb/session/auth';
import { usePlace } from '@FluxWeb/navigation/usePlace';
import { useShell } from '@FluxWeb/shell/useShell';

/**
 * This account: who it is, how it signs in, what it is signed in on, and what it has watched.
 */
const AccountPage = () => {
  const { user, refresh } = useShell();
  const { go } = usePlace();

  return (
    <AccountArea
      user={user}
      onChanged={() => {
        void refresh();
      }}
      onSignOut={() => {
        void signOut().then(() => {
          go({ section: 'home', search: '', inspecting: null, playing: null });

          return refresh();
        });
      }}
    />
  );
};

AccountPage.displayName = 'AccountPage';

export { AccountPage };
