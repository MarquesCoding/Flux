import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsPanel } from './AccountsPanel';

const mocks = vi.hoisted(() => ({
  fetchPermissionCatalogue: vi.fn(),
  fetchRoles: vi.fn(),
  fetchAccountPermissions: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  setOverride: vi.fn(),
  clearOverride: vi.fn(),
}));

vi.mock('@FluxWeb/admin/fetchRoles', () => mocks);

const ACCOUNTS = [
  { id: 'usr_1', name: 'Dan', email: 'dan@flux.local', role: 'admin', createdAt: '' },
  { id: 'usr_2', name: 'Sam', email: 'sam@flux.local', role: null, createdAt: '' },
];

const ADMINISTRATOR = {
  id: 'role_1',
  name: 'Administrator',
  position: 300,
  permissions: ['administrator'],
};

const MEMBER = { id: 'role_2', name: 'Member', position: 100, permissions: ['sharing.link'] };

describe('AccountsPanel', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.fetchPermissionCatalogue.mockResolvedValue(['jobs.run', 'jobs.runDestructive']);
    mocks.fetchRoles.mockResolvedValue([ADMINISTRATOR, MEMBER]);
    mocks.fetchAccountPermissions.mockResolvedValue({
      roles: [MEMBER],
      overrides: [],
      effective: ['sharing.link'],
    });
    mocks.assignRole.mockResolvedValue(null);
    mocks.removeRole.mockResolvedValue(null);
    mocks.setOverride.mockResolvedValue(null);
    mocks.clearOverride.mockResolvedValue(null);
  });

  it('lists everybody with an account', async () => {
    render(<AccountsPanel accounts={ACCOUNTS} />);

    expect(await screen.findByText('dan@flux.local')).toBeInTheDocument();
    expect(screen.getByText('sam@flux.local')).toBeInTheDocument();
  });

  it('counts them without saying "1 accounts"', () => {
    render(<AccountsPanel accounts={[ACCOUNTS[0]!]} />);

    expect(screen.getByText('1 account')).toBeInTheDocument();
  });

  it('says when nobody has one', () => {
    render(<AccountsPanel accounts={[]} />);

    expect(screen.getByText('Nobody has an account yet.')).toBeInTheDocument();
  });

  it('asks the server for nobody until somebody is picked', () => {
    render(<AccountsPanel accounts={ACCOUNTS} />);

    expect(mocks.fetchAccountPermissions).not.toHaveBeenCalled();
  });

  it('shows what somebody may do once picked', async () => {
    const user = userEvent.setup();
    render(<AccountsPanel accounts={ACCOUNTS} />);

    await user.click(await screen.findByRole('button', { name: /Dan/ }));

    expect(await screen.findByText('What Dan may do')).toBeInTheDocument();
    expect(screen.getByText('1 permission in all')).toBeInTheDocument();
  });

  it('closes again when the same account is pressed twice', async () => {
    const user = userEvent.setup();
    render(<AccountsPanel accounts={ACCOUNTS} />);

    await user.click(await screen.findByRole('button', { name: /Dan/ }));
    await screen.findByText('What Dan may do');
    await user.click(screen.getByRole('button', { name: /Dan/ }));

    expect(screen.queryByText('What Dan may do')).not.toBeInTheDocument();
  });

  describe('roles', () => {
    it('marks the ones they hold', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));

      expect(await screen.findByRole('button', { name: 'Member' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Administrator' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('gives one they do not hold', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));
      await user.click(await screen.findByRole('button', { name: 'Administrator' }));

      expect(mocks.assignRole).toHaveBeenCalledWith('usr_1', 'role_1');
    });

    it('takes back one they do', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));
      await user.click(await screen.findByRole('button', { name: 'Member' }));

      expect(mocks.removeRole).toHaveBeenCalledWith('usr_1', 'role_2');
    });

    it('reads their permissions again once a change lands', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));
      await user.click(await screen.findByRole('button', { name: 'Administrator' }));

      await waitFor(() => {
        expect(mocks.fetchAccountPermissions).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('exceptions', () => {
    it('says when there are none', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));

      expect(await screen.findByText('None. Their roles decide everything.')).toBeInTheDocument();
    });

    it('shows one they carry, in words', async () => {
      mocks.fetchAccountPermissions.mockResolvedValue({
        roles: [MEMBER],
        overrides: [{ permission: 'jobs.runDestructive', effect: 'deny' }],
        effective: ['sharing.link'],
      });

      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));

      expect(await screen.findByText('deny')).toBeInTheDocument();
      expect(screen.getByText('Run reset and rebuild')).toBeInTheDocument();
    });

    it('forgets one', async () => {
      mocks.fetchAccountPermissions.mockResolvedValue({
        roles: [MEMBER],
        overrides: [{ permission: 'jobs.runDestructive', effect: 'deny' }],
        effective: ['sharing.link'],
      });

      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));
      await user.click(
        await screen.findByRole('button', {
          name: 'Forget the deny on jobs.runDestructive',
        }),
      );

      expect(mocks.clearOverride).toHaveBeenCalledWith('usr_1', 'jobs.runDestructive');
    });

    it('will not allow or deny until a permission is picked', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));

      expect(await screen.findByRole('button', { name: 'Allow it' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Deny it' })).toBeDisabled();
    });
  });

  describe('refusals', () => {
    it('explains one rather than reporting a failure', async () => {
      mocks.assignRole.mockResolvedValue({ message: 'That role is at or above your own.' });

      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));
      await user.click(await screen.findByRole('button', { name: 'Administrator' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('at or above your own');
    });

    it('explains a lockout the server refused', async () => {
      mocks.removeRole.mockResolvedValue({
        message: 'That would leave nobody able to administer this server.',
      });

      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));
      await user.click(await screen.findByRole('button', { name: 'Member' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('nobody able to administer');
    });

    it('says nothing when the server was happy', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /Dan/ }));
      await user.click(await screen.findByRole('button', { name: 'Administrator' }));

      await waitFor(() => {
        expect(mocks.assignRole).toHaveBeenCalled();
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AccountsPanel.displayName).toBe('AccountsPanel');
  });
});
