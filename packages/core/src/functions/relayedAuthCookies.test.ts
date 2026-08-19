import { describe, expect, it } from 'vitest';
import { isRelayedAuthCookie } from './relayedAuthCookies';

describe('isRelayedAuthCookie', () => {
  it('relays the pending challenge, which is the whole point of this', () => {
    expect(isRelayedAuthCookie('better-auth.two_factor')).toBe(true);
  });

  it('relays the trusted device, or asking to be trusted would quietly do nothing', () => {
    expect(isRelayedAuthCookie('better-auth.trust_device')).toBe(true);
  });

  it('relays the same cookie under the name TLS gives it', () => {
    expect(isRelayedAuthCookie('__Secure-better-auth.two_factor')).toBe(true);
  });

  it('relays it under a prefix an operator chose', () => {
    expect(isRelayedAuthCookie('flux.two_factor')).toBe(true);
  });

  it('refuses the session cookie, which bearer already carries', () => {
    expect(isRelayedAuthCookie('better-auth.session_token')).toBe(false);
  });

  it('refuses a name that merely starts the same way', () => {
    expect(isRelayedAuthCookie('better-auth.two_factor_secret')).toBe(false);
  });

  it('refuses anything else a request cares to name', () => {
    expect(isRelayedAuthCookie('anything')).toBe(false);
  });
});
