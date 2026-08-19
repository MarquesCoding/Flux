import { describe, expect, it, vi } from 'vitest';
import { letTheBrowserSendThemBack } from './letTheBrowserSendThemBack';
import type { BrowserWindow } from 'electron';

type Cfg = {
  csp?: boolean;
  scheme?: boolean;
  bridges?: boolean;
  getWindow?: () => BrowserWindow | null;
};

const asked = (): Cfg | undefined => {
  const setupMain = vi.fn<(cfg: Cfg) => void>();

  letTheBrowserSendThemBack({ setupMain }, () => null);

  return setupMain.mock.calls[0]?.[0];
};

describe('letTheBrowserSendThemBack', () => {
  it('asks for the bridges by name, or the window calls a handler nobody registered', () => {
    expect(asked()).toMatchObject({ bridges: true });
  });

  it('asks for the scheme by name, or nothing claims the address the browser returns to', () => {
    expect(asked()).toMatchObject({ scheme: true });
  });

  it('refuses the policy built from an address that resolves nowhere on purpose', () => {
    expect(asked()).toMatchObject({ csp: false });
  });

  it('hands over a way to find the window rather than the window, which does not exist yet', () => {
    const setupMain = vi.fn<(cfg: Cfg) => void>();
    const window = () => null;

    letTheBrowserSendThemBack({ setupMain }, window);

    expect(setupMain.mock.calls[0]?.[0]).toMatchObject({ getWindow: window });
  });
});
