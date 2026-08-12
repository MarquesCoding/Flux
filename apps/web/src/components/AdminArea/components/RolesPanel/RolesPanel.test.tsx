import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesPanel } from './RolesPanel';

const mocks = vi.hoisted(() => ({
  fetchPermissionCatalogue: vi.fn(),
  fetchRoles: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  fetchAccountPermissions: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  setOverride: vi.fn(),
  clearOverride: vi.fn(),
}));

vi.mock('@FluxWeb/admin/fetchRoles', () => mocks);

const ACCOUNTS = [
  { id: 'usr_1', name: 'Dan', email: 'dan@flux.local', role: 'admin', createdAt: '' },
];

const ADMINISTRATOR = {
  id: 'role_1',
  name: 'Administrator',
  position: 300,
  permissions: ['administrator'],
};

const MEMBER = { id: 'role_2', name: 'Member', position: 100, permissions: ['sharing.link'] };

describe('RolesPanel', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.fetchPermissionCatalogue.mockResolvedValue([
      'administrator',
      'jobs.run',
      'jobs.runDestructive',
    ]);
    mocks.fetchRoles.mockResolvedValue([ADMINISTRATOR, MEMBER]);
    mocks.fetchAccountPermissions.mockResolvedValue({
      roles: [MEMBER],
      overrides: [],
      effective: ['sharing.link'],
    });
    mocks.createRole.mockResolvedValue(null);
    mocks.updateRole.mockResolvedValue(null);
    mocks.deleteRole.mockResolvedValue(null);
    mocks.assignRole.mockResolvedValue(null);
    mocks.removeRole.mockResolvedValue(null);
    mocks.setOverride.mockResolvedValue(null);
    mocks.clearOverride.mockResolvedValue(null);
  });

  it('lists the roles the server has', async () => {
    render(<RolesPanel accounts={ACCOUNTS} />);

    expect(await screen.findByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('says a role grants everything rather than counting to one', async () => {
    render(<RolesPanel accounts={ACCOUNTS} />);

    expect(await screen.findByText('Everything')).toBeInTheDocument();
  });

  it('counts one permission without saying "1 permissions"', async () => {
    render(<RolesPanel accounts={ACCOUNTS} />);

    expect(await screen.findByText('1 permission')).toBeInTheDocument();
  });

  it('will not create a role with no name', async () => {
    render(<RolesPanel accounts={ACCOUNTS} />);

    expect(await screen.findByRole('button', { name: /Create/ })).toBeDisabled();
  });

  it('creates a role below everybody already using the server', async () => {
    const user = userEvent.setup();
    render(<RolesPanel accounts={ACCOUNTS} />);

    await user.type(await screen.findByLabelText('New role'), 'Housemate');
    await user.click(screen.getByRole('button', { name: /Create/ }));

    expect(mocks.createRole).toHaveBeenCalledWith({
      name: 'Housemate',
      position: 50,
      permissions: [],
    });
  });

  describe('what a role grants', () => {
    it('stays shut until a role is picked', async () => {
      render(<RolesPanel accounts={ACCOUNTS} />);

      await screen.findByText('Administrator');

      expect(screen.queryByText(/What .* grants/)).not.toBeInTheDocument();
    });

    it('draws the catalogue the server gave, grouped', async () => {
      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));

      expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument();
      expect(screen.getByLabelText('Run reset and rebuild')).toBeInTheDocument();
    });

    it('shows what the role already has ticked', async () => {
      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /^Administrator/ }));

      expect(screen.getByLabelText(/Everything, including anything added later/)).toBeChecked();
      expect(screen.getByLabelText('Run a job')).not.toBeChecked();
    });

    it('adds a permission the role did not have', async () => {
      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.click(screen.getByLabelText('Run a job'));

      expect(mocks.updateRole).toHaveBeenCalledWith('role_2', {
        permissions: ['sharing.link', 'jobs.run'],
      });
    });
  });

  describe('refusals', () => {
    it('explains being outranked rather than reporting a failure', async () => {
      mocks.updateRole.mockResolvedValue({ message: 'That role is at or above your own.' });

      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.click(screen.getByLabelText('Run a job'));

      expect(await screen.findByRole('alert')).toHaveTextContent('at or above your own');
    });

    it('explains a lockout the server refused', async () => {
      mocks.deleteRole.mockResolvedValue({
        message: 'That would leave nobody able to administer this server.',
      });

      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: 'Delete Administrator' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('nobody able to administer');
    });

    it('says nothing when the server was happy', async () => {
      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: 'Delete Member' }));

      await waitFor(() => {
        expect(mocks.deleteRole).toHaveBeenCalled();
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('reads the roles again once a change lands', async () => {
      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: 'Delete Member' }));

      await waitFor(() => {
        expect(mocks.fetchRoles).toHaveBeenCalledTimes(2);
      });
    });

    it('does not read them again when the change was refused', async () => {
      mocks.deleteRole.mockResolvedValue({ message: 'That role is at or above your own.' });

      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: 'Delete Member' }));
      await screen.findByRole('alert');

      expect(mocks.fetchRoles).toHaveBeenCalledTimes(1);
    });
  });

  describe('who holds what', () => {
    it('lists the accounts', async () => {
      render(<RolesPanel accounts={ACCOUNTS} />);

      expect(await screen.findByText('dan@flux.local')).toBeInTheDocument();
    });

    it('shows what an account holds once picked', async () => {
      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: 'dan@flux.local' }));

      expect(await screen.findByText('Comes to 1 permissions')).toBeInTheDocument();
      expect(screen.getByText('None. Their roles decide everything.')).toBeInTheDocument();
    });

    it('gives a role the account does not hold', async () => {
      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: 'dan@flux.local' }));
      await user.click(
        await screen.findByRole('button', { name: 'Administrator', pressed: false }),
      );

      expect(mocks.assignRole).toHaveBeenCalledWith('usr_1', 'role_1');
    });

    it('takes back one it does hold', async () => {
      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: 'dan@flux.local' }));
      await user.click(await screen.findByRole('button', { name: 'Member', pressed: true }));

      expect(mocks.removeRole).toHaveBeenCalledWith('usr_1', 'role_2');
    });

    it('shows an exception the account carries', async () => {
      mocks.fetchAccountPermissions.mockResolvedValue({
        roles: [MEMBER],
        overrides: [{ permission: 'jobs.runDestructive', effect: 'deny' }],
        effective: ['sharing.link'],
      });

      const user = userEvent.setup();
      render(<RolesPanel accounts={ACCOUNTS} />);

      await user.click(await screen.findByRole('button', { name: 'dan@flux.local' }));

      expect(await screen.findByText('deny')).toBeInTheDocument();
      expect(screen.getByText('Run reset and rebuild')).toBeInTheDocument();
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(RolesPanel.displayName).toBe('RolesPanel');
  });
});
