import { beforeEach, describe, expect, it } from 'vitest';
import { theCookieJar } from './theCookieJar';
import type { CookieJar } from './theCookieJar';

let jar: CookieJar;

beforeEach(() => {
  jar = theCookieJar();
});

describe('theCookieJar', () => {
  it('carries nothing before the server has set anything', () => {
    expect(jar.carried()).toBe('');
  });

  it('keeps what the server set, and sends it back', () => {
    jar.keep(['better-auth.session_token=abc.def; Path=/; HttpOnly; SameSite=Lax']);

    expect(jar.carried()).toBe('better-auth.session_token=abc.def');
  });

  it('keeps the challenge a second factor is carried in, which is the whole point', () => {
    jar.keep([
      'better-auth.two_factor=2fa-abc.sig; Max-Age=600; HttpOnly',
      'better-auth.session_token=; Max-Age=0',
    ]);

    expect(jar.carried()).toBe('better-auth.two_factor=2fa-abc.sig');
  });

  it('takes the newer word on a cookie it already held', () => {
    jar.keep(['a=first; Path=/']);
    jar.keep(['a=second; Path=/']);

    expect(jar.carried()).toBe('a=second');
  });

  it('lets go of one the server emptied, which is how a spent challenge is cleared', () => {
    jar.keep(['a=first', 'b=kept']);
    jar.keep(['a=; Max-Age=0']);

    expect(jar.carried()).toBe('b=kept');
  });

  it('lets go of one the server expired in the past', () => {
    jar.keep(['a=first']);
    jar.keep(['a=first; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);

    expect(jar.carried()).toBe('');
  });

  it('keeps a signed value exactly as it was, since rewriting one stops it verifying', () => {
    jar.keep(['n=abc.d-e_f%3D; Path=/']);

    expect(jar.carried()).toBe('n=abc.d-e_f%3D');
  });

  it('keeps an equals sign inside a value, which base64 puts there', () => {
    jar.keep(['n=a=b; Path=/']);

    expect(jar.carried()).toBe('n=a=b');
  });

  it('sends several the way a request sends several', () => {
    jar.keep(['a=1', 'b=2']);

    expect(jar.carried()).toBe('a=1; b=2');
  });

  it('ignores a line that names nothing', () => {
    jar.keep(['', 'nonsense', '=b']);

    expect(jar.carried()).toBe('');
  });

  it('empties when somebody signs out, rather than holding a session nobody wants', () => {
    jar.keep(['a=1']);
    jar.empty();

    expect(jar.carried()).toBe('');
  });
});
