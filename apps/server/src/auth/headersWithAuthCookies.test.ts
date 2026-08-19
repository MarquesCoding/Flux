import { describe, expect, it } from 'vitest';
import { headersWithAuthCookies } from './headersWithAuthCookies';

describe('headersWithAuthCookies', () => {
  it('turns what a client is holding into the cookie better-auth reads', () => {
    const carried = headersWithAuthCookies(
      new Headers({ 'x-flux-auth-cookies': 'better-auth.two_factor=2fa-abc.sig' }),
    );

    expect(carried.get('cookie')).toBe('better-auth.two_factor=2fa-abc.sig');
  });

  it('carries the trusted device too, or asking to be trusted would do nothing', () => {
    const carried = headersWithAuthCookies(
      new Headers({ 'x-flux-auth-cookies': 'better-auth.trust_device=tok!id' }),
    );

    expect(carried.get('cookie')).toBe('better-auth.trust_device=tok!id');
  });

  it('refuses to let a request name the session cookie, which is not this path to present', () => {
    const carried = headersWithAuthCookies(
      new Headers({ 'x-flux-auth-cookies': 'better-auth.session_token=stolen' }),
    );

    expect(carried.get('cookie')).toBeNull();
  });

  it('keeps the ones it will take and drops the rest of what it was handed', () => {
    const carried = headersWithAuthCookies(
      new Headers({
        'x-flux-auth-cookies': 'better-auth.session_token=no; better-auth.two_factor=yes',
      }),
    );

    expect(carried.get('cookie')).toBe('better-auth.two_factor=yes');
  });

  it('adds to a cookie the request already carried rather than replacing it', () => {
    const carried = headersWithAuthCookies(
      new Headers({
        cookie: 'better-auth.session_token=real',
        'x-flux-auth-cookies': 'better-auth.two_factor=abc',
      }),
    );

    expect(carried.get('cookie')).toBe('better-auth.session_token=real; better-auth.two_factor=abc');
  });

  it('sends nothing for a cookie the client was told to let go of', () => {
    const carried = headersWithAuthCookies(new Headers({ 'x-flux-auth-cookies': 'a.two_factor=' }));

    expect(carried.get('cookie')).toBeNull();
  });

  it('leaves a request holding nothing exactly as it was', () => {
    const original = new Headers({ cookie: 'better-auth.session_token=real' });

    expect(headersWithAuthCookies(original)).toBe(original);
  });

  it('leaves the headers it was given alone, since a request is not ours to change', () => {
    const original = new Headers({ 'x-flux-auth-cookies': 'better-auth.two_factor=abc' });

    headersWithAuthCookies(original);

    expect(original.get('cookie')).toBeNull();
  });
});
