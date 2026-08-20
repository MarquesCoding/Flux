import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getAppPath: () => '/an/app' } }));

vi.mock('@FluxDesktop/main/theServerAddress', () => ({ theServerAddress: () => watching }));

let watching = '';

const { showTheApplication } = await import('./showTheApplication');

const aWindow = () => ({ loadURL: vi.fn(() => Promise.resolve()), loadFile: vi.fn(() => Promise.resolve()) });

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

  it('asks from the page it ships once it is packaged, where there is no dev server', async () => {
    const window = aWindow();
    await showTheApplication(window);

    expect(window.loadFile).toHaveBeenCalledWith('/an/app/dist/index.html');
  });
});
