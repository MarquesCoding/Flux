import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@FluxWeb/testing/renderInAShell';
import { AccountPage } from './AccountPage';
import type { AccountAreaProps } from '@FluxWeb/components/AccountArea/AccountArea.types';

const drawn = vi.hoisted((): { props: AccountAreaProps | null } => ({ props: null }));
const signOut = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/session/auth', () => ({ signOut }));

vi.mock('@FluxWeb/components/AccountArea/AccountArea', () => ({
  AccountArea: (props: AccountAreaProps) => {
    drawn.props = props;

    return <p>{props.user.name}</p>;
  },
}));

beforeEach(() => {
  drawn.props = null;
  signOut.mockReset().mockResolvedValue(undefined);
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
