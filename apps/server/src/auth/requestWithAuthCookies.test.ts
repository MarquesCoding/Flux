import { describe, expect, it } from 'vitest';
import { requestWithAuthCookies } from './requestWithAuthCookies';

const verifying = (headers: Record<string, string>): Request =>
  new Request('http://flux.test/api/auth/two-factor/verify-totp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ code: '123456' }),
  });

describe('requestWithAuthCookies', () => {
  it('hands on a request better-auth can read the challenge from', () => {
    const carried = requestWithAuthCookies(
      verifying({ 'x-flux-auth-cookies': 'better-auth.two_factor=abc' }),
    );

    expect(carried.headers.get('cookie')).toBe('better-auth.two_factor=abc');
  });

  it('keeps the body, which is where the code somebody typed is', async () => {
    const carried = requestWithAuthCookies(
      verifying({ 'x-flux-auth-cookies': 'better-auth.two_factor=abc' }),
    );

    expect(carried.method).toBe('POST');
    await expect(carried.text()).resolves.toBe('{"code":"123456"}');
  });

  it('returns the very same request where there is nothing to put back', () => {
    const original = verifying({});

    expect(requestWithAuthCookies(original)).toBe(original);
  });
});
