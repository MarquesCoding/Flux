import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, platformInUse } from '@FluxClient/platform/installPlatform';
import { installDesktopPlatform } from './installDesktopPlatform';

const onDisk = new Map<string, string>();

const aBridge = () => ({
  preferences: {
    held: Object.freeze(Object.fromEntries(onDisk)),
    write: (key: string, value: string) => {
      onDisk.set(key, value);
    },
    forget: (key: string) => {
      onDisk.delete(key);
    },
  },
});

beforeEach(() => {
  forgetPlatform();
  onDisk.clear();
  vi.stubGlobal('flux', aBridge());
});

afterEach(() => {
  forgetPlatform();
  vi.unstubAllGlobals();
});

describe('installDesktopPlatform', () => {
  it('leaves the application able to say what it is running on', () => {
    expect(() => platformInUse()).toThrow();

    installDesktopPlatform();

    expect(() => platformInUse()).not.toThrow();
  });

  it('writes the address down where the process that owns the window will read it', () => {
    installDesktopPlatform();

    platformInUse().store.write('flux.server.address', 'https://flux.example.com');

    expect(onDisk.get('flux.server.address')).toBe('https://flux.example.com');
  });

  it('names the machine rather than the engine, so a sessions list reads like a household', () => {
    installDesktopPlatform();

    expect(platformInUse().describeThisClient()).toContain('Valence');
  });

  it('opens no socket, since this page is gone before anything live would matter', () => {
    installDesktopPlatform();

    const link = platformInUse().openSocket({
      onOpen: () => {},
      onMessage: () => {},
      onClose: () => {},
    });

    expect(() => {
      link.send('anything');
      link.close();
    }).not.toThrow();
  });

  it('is the same running client however often it is asked', () => {
    installDesktopPlatform();

    expect(platformInUse().thisClientId()).toBe(platformInUse().thisClientId());
  });
});
