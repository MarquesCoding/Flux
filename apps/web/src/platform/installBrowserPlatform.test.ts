import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, platformInUse } from '@FluxClient/platform/installPlatform';
import { installBrowserPlatform } from './installBrowserPlatform';

beforeEach(() => {
  forgetPlatform();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('installBrowserPlatform', () => {
  it('leaves the application able to say what it is running on', () => {
    expect(() => platformInUse()).toThrow();

    installBrowserPlatform();

    expect(() => platformInUse()).not.toThrow();
  });

  it('keeps what it is told in the browser, where a reload will find it again', () => {
    installBrowserPlatform();

    platformInUse().store.write('the-theme', 'dark');

    expect(window.localStorage.getItem('the-theme')).toBe('dark');
    expect(platformInUse().store.read('the-theme')).toBe('dark');

    platformInUse().store.forget('the-theme');

    expect(platformInUse().store.read('the-theme')).toBeNull();
  });

  it('describes the client from the browser rather than from a name it made up', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Firefox/121.0',
    });

    installBrowserPlatform();

    expect(platformInUse().describeThisClient()).toBe('Firefox on macOS');
  });

  it('gives this tab an identity that survives being asked twice', () => {
    installBrowserPlatform();

    expect(platformInUse().thisClientId()).toBe(platformInUse().thisClientId());
  });
});
