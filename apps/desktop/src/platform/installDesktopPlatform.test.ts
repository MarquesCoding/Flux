import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetPlatform, platformInUse } from '@FluxClient/platform/installPlatform';
import { rememberServerAddress } from '@FluxClient/session/serverAddress';
import { installDesktopPlatform } from './installDesktopPlatform';

beforeEach(() => {
  forgetPlatform();
  window.localStorage.clear();
});

afterEach(() => {
  forgetPlatform();
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

  it('watches the server it was told about, which outlives the window', () => {
    installDesktopPlatform();

    rememberServerAddress('https://flux.example.com');

    expect(platformInUse().whereTheServerIs()).toBe('https://flux.example.com');
  });

  it('keeps what belongs to the machine where a machine keeps things', () => {
    installDesktopPlatform();

    platformInUse().store.write('the-theme', 'dark');

    expect(window.localStorage.getItem('the-theme')).toBe('dark');
  });

  it('is the same running client however often it is asked', () => {
    installDesktopPlatform();

    expect(platformInUse().thisClientId()).toBe(platformInUse().thisClientId());
  });
});
