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
}));

vi.mock('@FluxWeb/admin/fetchRoles', () => mocks);

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
    mocks.createRole.mockResolvedValue(null);
    mocks.updateRole.mockResolvedValue(null);
    mocks.deleteRole.mockResolvedValue(null);
  });

  it('lists the roles the server has', async () => {
    render(<RolesPanel />);

    expect(await screen.findByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('says a role grants everything rather than counting to one', async () => {
    render(<RolesPanel />);

    expect(await screen.findByText('Everything')).toBeInTheDocument();
  });

  it('counts one permission without saying "1 permissions"', async () => {
    render(<RolesPanel />);

    expect(await screen.findByText('1 permission')).toBeInTheDocument();
  });

  it('will not create a role with no name', async () => {
    render(<RolesPanel />);

    expect(await screen.findByRole('button', { name: /Create/ })).toBeDisabled();
  });

  it('creates a role below everybody already using the server', async () => {
    const user = userEvent.setup();
    render(<RolesPanel />);

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
      render(<RolesPanel />);

      await screen.findByText('Administrator');

      expect(screen.queryByText(/What .* grants/)).not.toBeInTheDocument();
    });

    it('draws the catalogue the server gave, grouped', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));

      expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument();
      expect(screen.getByLabelText('Run reset and rebuild')).toBeInTheDocument();
    });

    it('shows what the role already has ticked', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Administrator/ }));

      expect(screen.getByLabelText(/Everything, including anything added later/)).toBeChecked();
      expect(screen.getByLabelText('Run a job')).not.toBeChecked();
    });

    it('adds a permission the role did not have', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.click(screen.getByLabelText('Run a job'));

      expect(mocks.updateRole).toHaveBeenCalledWith('role_2', {
        permissions: ['sharing.link', 'jobs.run'],
      });
    });
  });

  describe('renaming and re-ranking', () => {
    it('seeds the fields from the role that was picked', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));

      expect(screen.getByLabelText('Name')).toHaveValue('Member');
      expect(screen.getByLabelText('Rank')).toHaveValue(100);
    });

    it('will not save a change that is not one', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('will not save a role with no name', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.clear(screen.getByLabelText('Name'));

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('renames a role', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'Housemate');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(mocks.updateRole).toHaveBeenCalledWith('role_2', {
        name: 'Housemate',
        position: 100,
      });
    });

    it('re-ranks a role, which is what makes the hierarchy usable at all', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.clear(screen.getByLabelText('Rank'));
      await user.type(screen.getByLabelText('Rank'), '250');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(mocks.updateRole).toHaveBeenCalledWith('role_2', {
        name: 'Member',
        position: 250,
      });
    });

    it('leaves the rank alone rather than sending nonsense when the field is empty', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.clear(screen.getByLabelText('Rank'));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'Housemate');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(mocks.updateRole).toHaveBeenCalledWith('role_2', { name: 'Housemate' });
    });

    it('explains a rank the server would not accept', async () => {
      mocks.updateRole.mockResolvedValue({ message: 'That role is at or above your own.' });

      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.clear(screen.getByLabelText('Rank'));
      await user.type(screen.getByLabelText('Rank'), '900');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('at or above your own');
    });
  });

  describe('refusals', () => {
    it('explains being outranked rather than reporting a failure', async () => {
      mocks.updateRole.mockResolvedValue({ message: 'That role is at or above your own.' });

      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: /^Member/ }));
      await user.click(screen.getByLabelText('Run a job'));

      expect(await screen.findByRole('alert')).toHaveTextContent('at or above your own');
    });

    it('explains a lockout the server refused', async () => {
      mocks.deleteRole.mockResolvedValue({
        message: 'That would leave nobody able to administer this server.',
      });

      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: 'Delete Administrator' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('nobody able to administer');
    });

    it('says nothing when the server was happy', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: 'Delete Member' }));

      await waitFor(() => {
        expect(mocks.deleteRole).toHaveBeenCalled();
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('reads the roles again once a change lands', async () => {
      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: 'Delete Member' }));

      await waitFor(() => {
        expect(mocks.fetchRoles).toHaveBeenCalledTimes(2);
      });
    });

    it('does not read them again when the change was refused', async () => {
      mocks.deleteRole.mockResolvedValue({ message: 'That role is at or above your own.' });

      const user = userEvent.setup();
      render(<RolesPanel />);

      await user.click(await screen.findByRole('button', { name: 'Delete Member' }));
      await screen.findByRole('alert');

      expect(mocks.fetchRoles).toHaveBeenCalledTimes(1);
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(RolesPanel.displayName).toBe('RolesPanel');
  });
});
