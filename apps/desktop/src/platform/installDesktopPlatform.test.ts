import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, platformInUse } from '@FluxClient/platform/installPlatform';
import { rememberServerAddress } from '@FluxClient/session/serverAddress';
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

  it('says it watches nowhere until somebody has said where', () => {
    installDesktopPlatform();

    expect(platformInUse().whereTheServerIs()).toBe('');
  });

  it('watches the server it was told about', () => {
    installDesktopPlatform();

    rememberServerAddress('https://flux.example.com');

    expect(platformInUse().whereTheServerIs()).toBe('https://flux.example.com');
  });


  it('reads what the file already held, so somebody is asked once rather than at every launch', () => {
    onDisk.set('flux.server.address', 'https://flux.example.com');

    vi.stubGlobal('flux', aBridge());
    installDesktopPlatform();

    expect(platformInUse().whereTheServerIs()).toBe('https://flux.example.com');
  });



  it('is the same running client however often it is asked', () => {
    installDesktopPlatform();

    expect(platformInUse().thisClientId()).toBe(platformInUse().thisClientId());
  });
});
