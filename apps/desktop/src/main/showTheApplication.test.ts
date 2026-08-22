import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getAppPath: () => '/an/app' },
  net: { fetch: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));

vi.mock('@FluxDesktop/main/theServerAddress', () => ({ theServerAddress: () => '' }));

const { showTheApplication } = await import('./showTheApplication');

const aWindow = () => ({
  loadURL: vi.fn<(address: string) => Promise<void>>(() => Promise.resolve()),
});

describe('showTheApplication', () => {
  it('opens this client, which draws Flux rather than fetching it as pages', async () => {
    const window = aWindow();

    await showTheApplication(window);

    expect(window.loadURL).toHaveBeenCalledWith('flux://app/');
  });

  it('opens the same address whether or not a server has been named', async () => {
    const first = aWindow();
    const second = aWindow();

    await showTheApplication(first);
    await showTheApplication(second);

    expect(first.loadURL.mock.calls).toEqual(second.loadURL.mock.calls);
  });

  it('never opens a server directly, which is what made this a window onto somebody else', async () => {
    const window = aWindow();

    await showTheApplication(window);

    const asked = String(window.loadURL.mock.calls[0]?.[0] ?? '');

    expect(asked.startsWith('http://')).toBe(false);
    expect(asked.startsWith('https://')).toBe(false);
  });
});
