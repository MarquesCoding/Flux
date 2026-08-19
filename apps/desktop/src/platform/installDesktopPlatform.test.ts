import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, platformInUse } from '@FluxClient/platform/installPlatform';
import { rememberServerAddress } from '@FluxClient/session/serverAddress';
import { installDesktopPlatform } from './installDesktopPlatform';

const onDisk = new Map<string, string>();

vi.mock('@tauri-apps/plugin-store', () => ({
  load: () =>
    Promise.resolve({
      entries: () => Promise.resolve([...onDisk.entries()]),
      set: (key: string, value: string) => {
        onDisk.set(key, value);

        return Promise.resolve();
      },
      delete: (key: string) => {
        onDisk.delete(key);

        return Promise.resolve();
      },
    }),
}));

beforeEach(() => {
  forgetPlatform();
  onDisk.clear();
});

afterEach(() => {
  forgetPlatform();
});

describe('installDesktopPlatform', () => {
  it('leaves the application able to say what it is running on', async () => {
    expect(() => platformInUse()).toThrow();

    await installDesktopPlatform();

    expect(() => platformInUse()).not.toThrow();
  });

  it('says it watches nowhere until somebody has said where', async () => {
    await installDesktopPlatform();

    expect(platformInUse().whereTheServerIs()).toBe('');
  });

  it('watches the server it was told about', async () => {
    await installDesktopPlatform();

    rememberServerAddress('https://flux.example.com');

    expect(platformInUse().whereTheServerIs()).toBe('https://flux.example.com');
  });


  it('reads what the file already held, so somebody is asked once rather than at every launch', async () => {
    onDisk.set('flux.server.address', 'https://flux.example.com');

    await installDesktopPlatform();

    expect(platformInUse().whereTheServerIs()).toBe('https://flux.example.com');
  });



  it('is the same running client however often it is asked', async () => {
    await installDesktopPlatform();

    expect(platformInUse().thisClientId()).toBe(platformInUse().thisClientId());
  });
});
