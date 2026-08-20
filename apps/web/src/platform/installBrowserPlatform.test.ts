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

  it('gives this tab an identity that survives being asked twice', () => {
    installBrowserPlatform();

    expect(platformInUse().thisClientId()).toBe(platformInUse().thisClientId());
  });
});
