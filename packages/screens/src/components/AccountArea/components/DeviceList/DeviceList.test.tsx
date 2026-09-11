import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceList } from './DeviceList';
import type { Device } from '@ValenceClient/account/fetchDevices';

const fetchDevices = vi.fn<() => Promise<Device[]>>();
const endDevice = vi.fn<(deviceId: string) => Promise<boolean>>();
const endOtherDevices = vi.fn<() => Promise<boolean>>();

vi.mock('@ValenceClient/account/fetchDevices', () => ({
  fetchDevices: () => fetchDevices(),
  endDevice: (deviceId: string) => endDevice(deviceId),
  endOtherDevices: () => endOtherDevices(),
}));

const device = (overrides: Partial<Device> = {}): Device => ({
  id: 'session-1',
  name: 'Chrome on macOS',
  address: '10.0.0.2',
  signedInAt: '2026-08-10T09:00:00.000Z',
  expiresAt: '2026-09-10T00:00:00.000Z',
  isCurrent: false,
  ...overrides,
});

beforeEach(() => {
  fetchDevices.mockReset().mockResolvedValue([]);
  endDevice.mockReset().mockResolvedValue(true);
  endOtherDevices.mockReset().mockResolvedValue(true);
});

/**
 * Signs a device out the way a person does: the menu, then the confirmation.
 */
const signOut = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: /Sign this out/ }));
  await user.click(await screen.findByRole('button', { name: 'Sign it out' }));
};

describe('DeviceList', () => {
  it('lists everywhere this account is signed in', async () => {
    fetchDevices.mockResolvedValue([
      device(),
      device({ id: 'session-2', name: 'Safari on iPhone' }),
    ]);

    render(<DeviceList />);

    expect(await screen.findByText('Chrome on macOS')).toBeInTheDocument();
    expect(screen.getByText('Safari on iPhone')).toBeInTheDocument();
  });

  it('marks the one being used, since somebody wants to know which they are holding', async () => {
    fetchDevices.mockResolvedValue([device({ isCurrent: true })]);

    render(<DeviceList />);

    expect(await screen.findByText('This one')).toBeInTheDocument();
  });

  it('offers no way to sign out of the page you are signing things out from', async () => {
    fetchDevices.mockResolvedValue([device({ isCurrent: true })]);

    render(<DeviceList />);
    await screen.findByText('This one');

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('signs one out on request, and asks again afterwards', async () => {
    const user = userEvent.setup();

    fetchDevices.mockResolvedValue([device()]);

    render(<DeviceList />);
    await signOut(user, 'Chrome on macOS');

    expect(endDevice).toHaveBeenCalledWith('session-1');
    await waitFor(() => {
      expect(fetchDevices).toHaveBeenCalledTimes(2);
    });
  });

  it('offers to sign out everywhere else only where there is an else', async () => {
    fetchDevices.mockResolvedValue([device({ isCurrent: true })]);

    render(<DeviceList />);
    await screen.findByText('This one');

    expect(
      screen.queryByRole('button', { name: /Sign out everywhere else/ }),
    ).not.toBeInTheDocument();
  });

  it('signs out everywhere else on request', async () => {
    const user = userEvent.setup();

    fetchDevices.mockResolvedValue([device({ isCurrent: true }), device({ id: 'session-2' })]);

    render(<DeviceList />);
    await user.click(await screen.findByRole('button', { name: /Sign out everywhere else/ }));
    await user.click(await screen.findByRole('button', { name: 'Sign them out' }));

    expect(endOtherDevices).toHaveBeenCalled();
  });

  it('puts that way out in the strip of the card holding the devices', async () => {
    fetchDevices.mockResolvedValue([device({ isCurrent: true }), device({ id: 'session-2' })]);

    render(<DeviceList />);

    const strip = (await screen.findByRole('heading', { name: 'Devices' })).closest('header');

    expect(strip).not.toBeNull();
    expect(
      await within(strip ?? document.body).findByRole('button', {
        name: /Sign out everywhere else/,
      }),
    ).toBeInTheDocument();
  });

  it('says so plainly when it has nothing to show', async () => {
    render(<DeviceList />);

    expect(await screen.findByText(/Nothing is signed in/)).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DeviceList.displayName).toBe('DeviceList');
  });
});
