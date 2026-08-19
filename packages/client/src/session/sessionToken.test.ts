import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { authorisation, rememberSessionToken, sessionToken } from './sessionToken';

beforeEach(() => {
  installPlatform(aFakePlatform());
});

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
  it('carries nothing in a browser, whose cookie says who it is', () => {
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
