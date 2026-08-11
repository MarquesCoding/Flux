import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountArea } from './AccountArea';
import type { SessionUser } from '@FluxContracts/schemas/Session';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const USER: SessionUser = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Marques',
  email: 'marques@flux.local',
  emailVerified: true,
  role: 'admin',
  twoFactorEnabled: false,
};

const PROFILE: ViewerProfile = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Marques',
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ profiles: [PROFILE] }),
  });

  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn() });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountArea', () => {
  it('says who the account belongs to', async () => {
    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Marques' })).toBeInTheDocument();
  });

  it('says which address signs in', () => {
    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={vi.fn()} />);

    expect(screen.getByText('marques@flux.local')).toBeInTheDocument();
  });

  it('marks an account that runs the server', () => {
    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={vi.fn()} />);

    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('does not call an ordinary account an admin', () => {
    render(
      <AccountArea user={{ ...USER, role: 'user' }} onChanged={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });

  it('keeps how somebody appears apart from how they get in', async () => {
    const actor = userEvent.setup();

    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={vi.fn()} />);

    expect(screen.getByText('How you appear')).toBeInTheDocument();

    await actor.click(screen.getByRole('button', { name: 'Security' }));

    expect(screen.queryByText('How you appear')).not.toBeInTheDocument();
    expect(screen.getByText('Getting in')).toBeInTheDocument();
  });

  it('opens the editor on the profile it read', async () => {
    const actor = userEvent.setup();

    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={vi.fn()} />);

    await actor.click(await screen.findByRole('button', { name: /Change/ }));

    expect(screen.getByLabelText('Name')).toHaveValue('Marques');
  });

  it('reads the profile again once it has been changed, so the face is the new one', async () => {
    const actor = userEvent.setup();

    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={vi.fn()} />);

    await actor.click(await screen.findByRole('button', { name: /Change/ }));

    const reads = fetchMock.mock.calls.length;

    await actor.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(reads + 1);
    });
  });

  it('tells the rest of the application when something it shows has changed', async () => {
    const onChanged = vi.fn();
    const actor = userEvent.setup();

    render(<AccountArea user={USER} onChanged={onChanged} onSignOut={vi.fn()} />);

    await actor.click(await screen.findByRole('button', { name: /Change/ }));
    await actor.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledOnce();
    });
  });

  it('closes the editor when the change is abandoned', async () => {
    const actor = userEvent.setup();

    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={vi.fn()} />);

    await actor.click(await screen.findByRole('button', { name: /Change/ }));
    await actor.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('signs out', async () => {
    const onSignOut = vi.fn();
    const actor = userEvent.setup();

    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={onSignOut} />);

    await actor.click(screen.getByRole('button', { name: /Sign out/ }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('says nothing about viewing being lost, because it is not', () => {
    render(<AccountArea user={USER} onChanged={vi.fn()} onSignOut={vi.fn()} />);

    expect(screen.getByText(/Nothing about what you have watched is lost/)).toBeInTheDocument();
  });
});
