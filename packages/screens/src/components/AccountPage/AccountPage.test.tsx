import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@FluxScreens/testing/renderInAShell';
import { AccountPage } from './AccountPage';
import type { AccountAreaProps } from '@FluxScreens/components/AccountArea/AccountArea.types';

const drawn = vi.hoisted((): { props: AccountAreaProps | null } => ({ props: null }));
const signOut = vi.hoisted(() => vi.fn());

vi.mock('@FluxClient/session/auth', () => ({ signOut }));

vi.mock('@FluxScreens/components/AccountArea/AccountArea', () => ({
  AccountArea: (props: AccountAreaProps) => {
    drawn.props = props;

    return <p>{props.user.name}</p>;
  },
}));

beforeEach(() => {
  drawn.props = null;
  signOut.mockReset().mockResolvedValue(true);
  window.history.replaceState(null, '', '/account');
});

describe('AccountPage', () => {
  it('is about whoever is signed in', () => {
    renderInAShell(<AccountPage />);

    expect(drawn.props?.user.name).toBe('Operator');
  });

  it('reads the account again when something about it changed', () => {
    const refresh = vi.fn();

    renderInAShell(<AccountPage />, { refresh });

    drawn.props?.onChanged?.();

    expect(refresh).toHaveBeenCalled();
  });

  it('stays put and says so when the server would not end the session', async () => {
    signOut.mockResolvedValue(false);

    renderInAShell(<AccountPage />);

    drawn.props?.onSignOut?.();

    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });

    expect(window.location.pathname).toBe('/account');
  });

  it('signs out, goes home, and reads the session again', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);

    renderInAShell(<AccountPage />, { refresh });

    drawn.props?.onSignOut?.();

    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });

    expect(signOut).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });
});
