import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getAppPath: () => '/an/app' } }));

vi.mock('@FluxDesktop/main/theServerAddress', () => ({ theServerAddress: () => watching }));

let watching = '';

const { showTheApplication } = await import('./showTheApplication');

const aWindow = (loadURL = vi.fn<(address: string) => Promise<void>>(() => Promise.resolve())) => ({
  loadURL,
  loadFile: vi.fn<(path: string, options?: { search?: string }) => Promise<void>>(() =>
    Promise.resolve(),
  ),
});

const unreachable = () =>
  vi.fn<(address: string) => Promise<void>>(() =>
    Promise.reject(new Error('ERR_CONNECTION_REFUSED (-102)')),
  );

beforeEach(() => {
  watching = '';
  delete process.env['ELECTRON_RENDERER_URL'];
});

afterEach(() => {
  delete process.env['ELECTRON_RENDERER_URL'];
});

describe('showTheApplication', () => {
  it('opens the Flux running on the server somebody named, not a copy of it', async () => {
    watching = 'https://flux.example.com';

    const window = aWindow();
    await showTheApplication(window);

    expect(window.loadURL).toHaveBeenCalledWith('https://flux.example.com');
    expect(window.loadFile).not.toHaveBeenCalled();
  });

  it('prefers the server over anything this client ships, once one is known', async () => {
    watching = 'https://flux.example.com';
    process.env['ELECTRON_RENDERER_URL'] = 'http://localhost:5174';

    const window = aWindow();
    await showTheApplication(window);

    expect(window.loadURL).toHaveBeenCalledWith('https://flux.example.com');
  });

  it('asks which Flux is theirs where nobody has said, from the dev server while it is worked on', async () => {
    process.env['ELECTRON_RENDERER_URL'] = 'http://localhost:5174';

    const window = aWindow();
    await showTheApplication(window);

    expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5174');
  });

  it('asks again where the server does not answer, rather than showing nothing at all', async () => {
    watching = 'https://flux.example.com';

    const window = aWindow(unreachable());
    await showTheApplication(window);

    expect(window.loadFile).toHaveBeenCalledWith('/an/app/dist/index.html', {
      search: 'unreachable=https%3A%2F%2Fflux.example.com',
    });
  });

  it('carries the address that failed, so nobody has to remember what they typed', async () => {
    watching = 'https://flux.example.com/under/a/path';

    const window = aWindow(unreachable());
    await showTheApplication(window);

    expect(window.loadFile.mock.calls[0]?.[1]?.search).toContain(
      encodeURIComponent('https://flux.example.com/under/a/path'),
    );
  });

  it('does not throw where the server is off, which is an ordinary Tuesday', async () => {
    watching = 'https://flux.example.com';

    await expect(showTheApplication(aWindow(unreachable()))).resolves.toBeUndefined();
  });

  it('asks from the page it ships once it is packaged, where there is no dev server', async () => {
    const window = aWindow();
    await showTheApplication(window);

    expect(window.loadFile).toHaveBeenCalledWith('/an/app/dist/index.html');
  });
});
