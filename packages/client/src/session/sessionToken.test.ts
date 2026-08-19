import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { authorisation, rememberSessionToken, sessionToken } from './sessionToken';

beforeEach(() => {
  installPlatform({ ...aFakePlatform(), whereTheServerIs: () => 'https://flux.example.com' });
});

const aBrowser = (): void => {
  forgetPlatform();
  installPlatform(aFakePlatform());
};

afterEach(() => {
  forgetPlatform();
});

describe('the token a client holds', () => {
  it('holds none until the server hands one out', () => {
    expect(sessionToken()).toBeNull();
  });

  it('keeps the one it was handed', () => {
    rememberSessionToken('a-session-token');

    expect(sessionToken()).toBe('a-session-token');
  });

  it('lets go of it when told to hold none', () => {
    rememberSessionToken('a-session-token');
    rememberSessionToken(null);

    expect(sessionToken()).toBeNull();
  });

  it('treats being handed an empty token as being handed none', () => {
    rememberSessionToken('a-session-token');
    rememberSessionToken('');

    expect(sessionToken()).toBeNull();
  });

  it('keeps it where a client keeps things, so it survives the window closing', () => {
    rememberSessionToken('a-session-token');

    expect(sessionToken()).toBe('a-session-token');

    installPlatform(aFakePlatform());

    expect(sessionToken()).toBeNull();
  });
});

describe('what a request carries to be recognised', () => {
  it('carries nothing where no token has been handed out', () => {
    expect(authorisation()).toEqual({});
  });

  it('carries the token where one is held', () => {
    rememberSessionToken('a-session-token');

    expect(authorisation()).toEqual({ authorization: 'Bearer a-session-token' });
  });

  it('carries nothing rather than an empty bearer', () => {
    rememberSessionToken('');

    expect(authorisation()).toEqual({});
  });
});

describe('a browser, which has a cookie and must not have a token', () => {
  it('never holds one, however often the server hands it one', () => {
    aBrowser();

    rememberSessionToken('a-session-token');

    expect(sessionToken()).toBeNull();
  });

  it('carries none, since better-auth would write it over the cookie that was working', () => {
    aBrowser();

    rememberSessionToken('a-session-token');

    expect(authorisation()).toEqual({});
  });

  it('lets go of one it was already holding, so a browser stuck on 401 comes right by itself', () => {
    const { store } = aFakePlatform();

    store.write('flux.session.token', 'from-before');

    forgetPlatform();
    installPlatform({ ...aFakePlatform(), store });

    rememberSessionToken('a-session-token');

    expect(store.read('flux.session.token')).toBeNull();
  });
});
