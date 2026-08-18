import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyPanel } from './ApiKeyPanel';
import type { ApiKey } from '@FluxContracts/schemas/ApiKey';

const { fetchMock, createMock, enableMock, revokeMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  createMock: vi.fn(),
  enableMock: vi.fn(),
  revokeMock: vi.fn(),
}));

vi.mock('@FluxClient/account/fetchApiKeys', () => ({
  fetchApiKeys: fetchMock,
  createApiKey: createMock,
  setApiKeyEnabled: enableMock,
  revokeApiKey: revokeMock,
}));

const key = (overrides: Partial<ApiKey> = {}): ApiKey => ({
  id: 'key-1',
  name: 'Home Assistant',
  start: 'flux_abc',
  enabled: true,
  expiresAt: null,
  lastRequestAt: null,
  requestCount: 0,
  permissions: null,
  rateLimit: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  fetchMock.mockReset();
  createMock.mockReset();
  enableMock.mockReset();
  revokeMock.mockReset();

  fetchMock.mockReturnValue(Promise.resolve([]));
  createMock.mockReturnValue(Promise.resolve(null));
  enableMock.mockReturnValue(Promise.resolve(true));
  revokeMock.mockReturnValue(Promise.resolve(true));
});

describe('ApiKeyPanel', () => {
  it('says so plainly when this account may not hold keys', async () => {
    fetchMock.mockReturnValue(Promise.resolve(null));

    render(<ApiKeyPanel />);

    expect(await screen.findByText(/not allowed to hold API keys/)).toBeInTheDocument();
  });

  it('says there are none rather than showing an empty list', async () => {
    render(<ApiKeyPanel />);

    expect(await screen.findByText('No keys yet.')).toBeInTheDocument();
  });

  it('names each key and shows enough of it to tell it apart', async () => {
    fetchMock.mockReturnValue(Promise.resolve([key()]));

    render(<ApiKeyPanel />);

    expect(await screen.findByText('Home Assistant')).toBeInTheDocument();
    expect(screen.getByText(/flux_abc/)).toBeInTheDocument();
  });

  it('says when a key was last used, in words rather than as a date', async () => {
    fetchMock.mockReturnValue(
      Promise.resolve([
        key({ lastRequestAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }),
      ]),
    );

    render(<ApiKeyPanel />);

    expect(await screen.findByText('Used 3 days ago')).toBeInTheDocument();
  });

  it('says a key has never been used, which is what makes it worth revoking', async () => {
    fetchMock.mockReturnValue(Promise.resolve([key()]));

    render(<ApiKeyPanel />);

    expect(await screen.findByText('Never used')).toBeInTheDocument();
  });

  it('makes a key with the name it was given', async () => {
    const user = userEvent.setup();

    createMock.mockReturnValue(Promise.resolve({ ...key(), key: 'flux_secret' }));

    render(<ApiKeyPanel />);

    await user.type(await screen.findByLabelText('What is this key for?'), 'Dashboard');
    await user.click(screen.getByRole('button', { name: 'Create key' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: 'Dashboard',
        expiresInDays: null,
        permissions: null,
        rateLimit: null,
      });
    });
  });

  it('shows the key itself once it is made, and warns that it will not be again', async () => {
    const user = userEvent.setup();

    createMock.mockReturnValue(Promise.resolve({ ...key(), key: 'flux_secret' }));

    render(<ApiKeyPanel />);

    await user.type(await screen.findByLabelText('What is this key for?'), 'Dashboard');
    await user.click(screen.getByRole('button', { name: 'Create key' }));

    expect(await screen.findByText('flux_secret')).toBeInTheDocument();
    expect(screen.getByText(/will not be shown again/)).toBeInTheDocument();
  });

  it('refuses to make one with no name, rather than making an unnamed key', async () => {
    const user = userEvent.setup();

    render(<ApiKeyPanel />);

    await user.click(await screen.findByRole('button', { name: 'Create key' }));

    expect(createMock).not.toHaveBeenCalled();
  });

  it('turns a key off without revoking it', async () => {
    const user = userEvent.setup();

    fetchMock.mockReturnValue(Promise.resolve([key()]));

    render(<ApiKeyPanel />);

    await user.click(await screen.findByRole('switch', { name: 'Turn Home Assistant off' }));

    expect(enableMock).toHaveBeenCalledWith('key-1', false);
  });

  it('turns one back on', async () => {
    const user = userEvent.setup();

    fetchMock.mockReturnValue(Promise.resolve([key({ enabled: false })]));

    render(<ApiKeyPanel />);

    await user.click(await screen.findByRole('switch', { name: 'Turn Home Assistant on' }));

    expect(enableMock).toHaveBeenCalledWith('key-1', true);
  });

  it('revokes a key', async () => {
    const user = userEvent.setup();

    fetchMock.mockReturnValue(Promise.resolve([key()]));

    render(<ApiKeyPanel />);

    await user.click(await screen.findByRole('button', { name: 'Revoke Home Assistant' }));

    expect(revokeMock).toHaveBeenCalledWith('key-1');
  });

  it('says what a narrowed key is narrowed to', async () => {
    fetchMock.mockReturnValue(Promise.resolve([key({ permissions: ['jobs.run'] })]));

    render(<ApiKeyPanel />);

    expect(await screen.findByText('1 permissions')).toBeInTheDocument();
  });

  it('says what a limited key is limited to', async () => {
    fetchMock.mockReturnValue(Promise.resolve([key({ rateLimit: { max: 60, everySeconds: 60 } })]));

    render(<ApiKeyPanel />);

    expect(await screen.findByText('60 per 60s')).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ApiKeyPanel.displayName).toBe('ApiKeyPanel');
  });
});
