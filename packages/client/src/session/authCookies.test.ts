import { afterEach, describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform, platformInUse } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { authCookies, forgetAuthCookies, rememberAuthCookies } from './authCookies';

const KEY = 'flux.auth.cookies';

const aClientWithNoSharedOrigin = (): void => {
  forgetPlatform();
  installPlatform({ ...aFakePlatform(), whereTheServerIs: () => 'https://flux.example.com' });
};

const aBrowser = (): void => {
  forgetPlatform();
  installPlatform(aFakePlatform());
};

afterEach(() => {
  forgetPlatform();
});

describe('authCookies', () => {
  it('holds what the server said to hold', () => {
    aClientWithNoSharedOrigin();

    rememberAuthCookies('a.two_factor=abc');

    expect(authCookies()).toBe('a.two_factor=abc');
  });

  it('holds nothing before the server has said anything', () => {
    aClientWithNoSharedOrigin();

    expect(authCookies()).toBeNull();
  });

  it('holds both, since a challenge and a trusted device are not the same thing', () => {
    aClientWithNoSharedOrigin();

    rememberAuthCookies('a.two_factor=abc');
    rememberAuthCookies('a.trust_device=xyz');

    expect(authCookies()).toBe('a.two_factor=abc; a.trust_device=xyz');
  });

  it('takes the newer word on a cookie it was already holding', () => {
    aClientWithNoSharedOrigin();

    rememberAuthCookies('a.two_factor=first');
    rememberAuthCookies('a.two_factor=second');

    expect(authCookies()).toBe('a.two_factor=second');
  });

  it('lets go of one the server emptied, which is how a spent challenge is cleared', () => {
    aClientWithNoSharedOrigin();

    rememberAuthCookies('a.two_factor=abc');
    rememberAuthCookies('a.two_factor=');

    expect(authCookies()).toBeNull();
  });

  it('takes both halves of one answer, which is what verifying with trust device sends', () => {
    aClientWithNoSharedOrigin();

    rememberAuthCookies('a.two_factor=abc');
    rememberAuthCookies('a.two_factor=; a.trust_device=xyz');

    expect(authCookies()).toBe('a.trust_device=xyz');
  });

  it('lets go of everything when asked, for somebody signing out', () => {
    aClientWithNoSharedOrigin();

    rememberAuthCookies('a.two_factor=abc');
    forgetAuthCookies();

    expect(authCookies()).toBeNull();
  });

  it('holds nothing in a browser, which has the real cookies and needs no copy', () => {
    aBrowser();

    rememberAuthCookies('a.two_factor=abc');

    expect(authCookies()).toBeNull();
    expect(platformInUse().store.read(KEY)).toBeNull();
  });
});
