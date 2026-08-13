import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsPanel } from './AccountsPanel';
import type { Account } from '@FluxWeb/admin/fetchAccounts';

const accountMocks = vi.hoisted(() => ({
  fetchAccounts: vi.fn(),
  inviteAccount: vi.fn(),
  banAccount: vi.fn(),
  unbanAccount: vi.fn(),
  removeAccount: vi.fn(),
}));

vi.mock('@FluxWeb/admin/fetchAccounts', () => accountMocks);

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

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'usr_1',
  name: 'Dan',
  email: 'dan@flux.local',
  createdAt: '',
  isBanned: false,
  banReason: null,
  position: 100,
  isAdministrator: false,
  roles: ['Member'],
  ...overrides,
});

const ACCOUNTS = [
  account(),
  account({ id: 'usr_2', name: 'Sam', email: 'sam@flux.local', position: null }),
];

const ADMINISTRATOR = {
  id: 'role_1',
  name: 'Administrator',
  position: 300,
  permissions: ['administrator'],
};

const MEMBER = { id: 'role_2', name: 'Member', position: 100, permissions: ['sharing.link'] };

/**
 * Opens a row's action menu and chooses one of the things in it.
 *
 * Ban and delete used to be buttons on the row itself. They live behind one
 * control now, so a test that wants one has to open the menu first — the same
 * two presses a person makes.
 */
const choose = async (user: ReturnType<typeof userEvent.setup>, name: string, action: RegExp) => {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
};

/**
 * Chooses something that has to be confirmed, and confirms it.
 *
 * Banning and deleting ask first now, so a test that wants the deed done has
 * to answer the question — the same two presses a person makes.
 */
const confirm = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  action: RegExp,
  answer: string,
) => {
  await choose(user, name, action);
  await user.click(await screen.findByRole('button', { name: answer }));
};

/**
 * Opens the dialog that adds somebody.
 *
 * The form used to sit at the foot of the card. It is behind a button in the
 * header now, so a test that fills it in has to open it first.
 */
const openInvite = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /Add user/ }));
};

describe('AccountsPanel', () => {
  beforeEach(() => {
    for (const mock of [...Object.values(mocks), ...Object.values(accountMocks)]) {
      mock.mockReset();
    }

    accountMocks.fetchAccounts.mockResolvedValue(ACCOUNTS);
    accountMocks.inviteAccount.mockResolvedValue(null);
    accountMocks.banAccount.mockResolvedValue(null);
    accountMocks.unbanAccount.mockResolvedValue(null);
    accountMocks.removeAccount.mockResolvedValue(null);

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
    render(<AccountsPanel />);

    expect(await screen.findByText('dan@flux.local')).toBeInTheDocument();
    expect(screen.getByText('sam@flux.local')).toBeInTheDocument();
  });

  it('says when nobody has one', async () => {
    accountMocks.fetchAccounts.mockResolvedValue([]);

    render(<AccountsPanel />);

    expect(await screen.findByText('Nobody has an account yet.')).toBeInTheDocument();
  });

  it('asks the server for nobody until somebody is picked', async () => {
    render(<AccountsPanel />);

    await screen.findByText('dan@flux.local');

    expect(mocks.fetchAccountPermissions).not.toHaveBeenCalled();
  });

  it('shows every role on the row, so a change is visible without opening it', async () => {
    accountMocks.fetchAccounts.mockResolvedValue([account({ roles: ['Manager', 'Member'] })]);

    render(<AccountsPanel />);

    expect(await screen.findByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('says so plainly when somebody holds none', async () => {
    accountMocks.fetchAccounts.mockResolvedValue([account({ roles: [] })]);

    render(<AccountsPanel />);

    expect(await screen.findByText('No roles')).toBeInTheDocument();
  });

  it('marks an administrator by what they resolve to, not by a column', async () => {
    accountMocks.fetchAccounts.mockResolvedValue([
      account({ isAdministrator: true, roles: ['Administrator'] }),
    ]);

    render(<AccountsPanel />);

    expect(await screen.findByText('Administrator')).toBeInTheDocument();
  });

  describe('banning', () => {
    it('bans somebody', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await confirm(user, 'Dan', /^Ban$/, 'Ban');

      expect(accountMocks.banAccount).toHaveBeenCalledWith('usr_1', expect.any(String));
    });

    it('shows a ban and why, in place of the address', async () => {
      accountMocks.fetchAccounts.mockResolvedValue([
        account({ isBanned: true, banReason: 'kept pausing the film' }),
      ]);

      render(<AccountsPanel />);

      expect(await screen.findByText('banned')).toBeInTheDocument();
      expect(screen.getByText(/kept pausing the film/)).toBeInTheDocument();
    });

    it('offers to let a banned account back in rather than banning it again', async () => {
      accountMocks.fetchAccounts.mockResolvedValue([account({ isBanned: true })]);

      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Let back in/);

      expect(accountMocks.unbanAccount).toHaveBeenCalledWith('usr_1');
      expect(accountMocks.banAccount).not.toHaveBeenCalled();
    });

    it('explains a refusal rather than reporting a failure', async () => {
      accountMocks.banAccount.mockResolvedValue({
        message: 'That would leave nobody able to administer this server.',
      });

      const user = userEvent.setup();
      render(<AccountsPanel />);

      await confirm(user, 'Dan', /^Ban$/, 'Ban');

      expect(await screen.findByRole('alert')).toHaveTextContent('nobody able to administer');
    });
  });

  describe('adding somebody', () => {
    it('will not add until every field is filled', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await openInvite(user);

      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    });

    it('will not accept a password too short to be one', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await openInvite(user);
      await user.type(screen.getByLabelText('Name'), 'Alex');
      await user.type(screen.getByLabelText('Address'), 'alex@flux.local');
      await user.type(screen.getByLabelText('Password'), 'short');

      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    });

    it('adds somebody', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await openInvite(user);
      await user.type(screen.getByLabelText('Name'), 'Alex');
      await user.type(screen.getByLabelText('Address'), 'alex@flux.local');
      await user.type(screen.getByLabelText('Password'), 'a-long-enough-password');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(accountMocks.inviteAccount).toHaveBeenCalledWith({
        name: 'Alex',
        email: 'alex@flux.local',
        password: 'a-long-enough-password',
      });
    });

    it('says the password has to be handed over, since Flux cannot send it', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await openInvite(user);

      expect(screen.getByText(/tell them this password yourself/)).toBeInTheDocument();
    });

    it('explains a refusal', async () => {
      accountMocks.inviteAccount.mockResolvedValue({
        message: 'That address is already in use.',
      });

      const user = userEvent.setup();
      render(<AccountsPanel />);

      await openInvite(user);
      await user.type(screen.getByLabelText('Name'), 'Alex');
      await user.type(screen.getByLabelText('Address'), 'dan@flux.local');
      await user.type(screen.getByLabelText('Password'), 'a-long-enough-password');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('already in use');
    });
  });

  describe('removing', () => {
    it('removes somebody', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await confirm(user, 'Dan', /Delete account/, 'Delete account');

      expect(accountMocks.removeAccount).toHaveBeenCalledWith('usr_1');
    });

    it('explains a refusal', async () => {
      accountMocks.removeAccount.mockResolvedValue({
        message: 'You cannot do that to your own account.',
      });

      const user = userEvent.setup();
      render(<AccountsPanel />);

      await confirm(user, 'Dan', /Delete account/, 'Delete account');

      expect(await screen.findByRole('alert')).toHaveTextContent('your own account');
    });
  });

  it('shows what somebody may do once picked', async () => {
    const user = userEvent.setup();
    render(<AccountsPanel />);

    await choose(user, 'Dan', /Edit roles/);

    expect(await screen.findByText('What Dan may do')).toBeInTheDocument();
    expect(screen.getByText('1 permission in all')).toBeInTheDocument();
  });

  it('closes what somebody may do, without having to pick another account', async () => {
    const user = userEvent.setup();
    render(<AccountsPanel />);

    await choose(user, 'Dan', /Edit roles/);
    await user.click(await screen.findByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('roles', () => {
    it('marks the ones they hold', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);

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
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);
      await user.click(await screen.findByRole('button', { name: 'Administrator' }));

      expect(mocks.assignRole).toHaveBeenCalledWith('usr_1', 'role_1');
    });

    it('takes back one they do', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);
      await user.click(await screen.findByRole('button', { name: 'Member' }));

      expect(mocks.removeRole).toHaveBeenCalledWith('usr_1', 'role_2');
    });

    it('reads their permissions again once a change lands', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);
      await user.click(await screen.findByRole('button', { name: 'Administrator' }));

      await waitFor(() => {
        expect(mocks.fetchAccountPermissions).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('exceptions', () => {
    it('says when there are none', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);

      expect(await screen.findByText('None. Their roles decide everything.')).toBeInTheDocument();
    });

    it('shows one they carry, in words', async () => {
      mocks.fetchAccountPermissions.mockResolvedValue({
        roles: [MEMBER],
        overrides: [{ permission: 'jobs.runDestructive', effect: 'deny' }],
        effective: ['sharing.link'],
      });

      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);

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
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);
      await user.click(
        await screen.findByRole('button', {
          name: 'Forget the deny on jobs.runDestructive',
        }),
      );

      expect(mocks.clearOverride).toHaveBeenCalledWith('usr_1', 'jobs.runDestructive');
    });

    it('will not allow or deny until a permission is picked', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);

      expect(await screen.findByRole('button', { name: 'Allow it' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Deny it' })).toBeDisabled();
    });
  });

  describe('refusals', () => {
    it('explains one rather than reporting a failure', async () => {
      mocks.assignRole.mockResolvedValue({ message: 'That role is at or above your own.' });

      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);
      await user.click(await screen.findByRole('button', { name: 'Administrator' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('at or above your own');
    });

    it('explains a lockout the server refused', async () => {
      mocks.removeRole.mockResolvedValue({
        message: 'That would leave nobody able to administer this server.',
      });

      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);
      await user.click(await screen.findByRole('button', { name: 'Member' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('nobody able to administer');
    });

    it('says nothing when the server was happy', async () => {
      const user = userEvent.setup();
      render(<AccountsPanel />);

      await choose(user, 'Dan', /Edit roles/);
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

describe('allowing and denying one thing for one person', () => {
  const openRoles = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<AccountsPanel />);

    await choose(user, 'Dan', /Edit roles/);
  };

  it('allows a permission somebody does not hold', async () => {
    const user = userEvent.setup();

    await openRoles(user);

    await user.click(await screen.findByRole('button', { name: 'Add an exception' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Run a job/ }));
    await user.click(screen.getByRole('button', { name: 'Allow it' }));

    await waitFor(() => {
      expect(mocks.setOverride).toHaveBeenCalledWith(
        'usr_1',
        expect.objectContaining({ effect: 'allow' }),
      );
    });
  });

  it('denies one they hold through a role', async () => {
    const user = userEvent.setup();

    await openRoles(user);

    await user.click(await screen.findByRole('button', { name: 'Add an exception' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Run a job/ }));
    await user.click(screen.getByRole('button', { name: 'Deny it' }));

    await waitFor(() => {
      expect(mocks.setOverride).toHaveBeenCalledWith(
        'usr_1',
        expect.objectContaining({ effect: 'deny' }),
      );
    });
  });

  it('offers nothing to allow or deny until one is picked', async () => {
    const user = userEvent.setup();

    await openRoles(user);

    expect(await screen.findByRole('button', { name: 'Allow it' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deny it' })).toBeDisabled();
  });
});
