import { describe, expect, it } from 'vitest';
import { exposeAuthCookies } from './exposeAuthCookies';

const answering = (setCookies: readonly string[], body = '{}'): Response =>
  new Response(body, { headers: setCookies.map((one) => ['set-cookie', one]) });

describe('exposeAuthCookies', () => {
  it('hands over the pending challenge, which a client cannot be sent as a cookie', () => {
    const answered = exposeAuthCookies(
      answering(['better-auth.two_factor=2fa-abc.sig; Max-Age=600; Path=/; HttpOnly']),
    );

    expect(answered.headers.get('x-flux-set-auth-cookies')).toBe('better-auth.two_factor=2fa-abc.sig');
  });

  it('leaves the attributes behind, since a client is holding a value rather than a cookie', () => {
    const answered = exposeAuthCookies(answering(['a.two_factor=v; Path=/; HttpOnly; SameSite=Lax']));

    expect(answered.headers.get('x-flux-set-auth-cookies')).toBe('a.two_factor=v');
  });

  it('hands over an emptied one, which is the server saying the challenge is over', () => {
    const answered = exposeAuthCookies(answering(['better-auth.two_factor=; Max-Age=0; Path=/']));

    expect(answered.headers.get('x-flux-set-auth-cookies')).toBe('better-auth.two_factor=');
  });

  it('hands over both at once, which is what verifying with trust device answers', () => {
    const answered = exposeAuthCookies(
      answering([
        'better-auth.two_factor=; Max-Age=0',
        'better-auth.trust_device=tok!id; Max-Age=2592000',
        'better-auth.session_token=new; Max-Age=604800',
      ]),
    );

    expect(answered.headers.get('x-flux-set-auth-cookies')).toBe(
      'better-auth.two_factor=; better-auth.trust_device=tok!id',
    );
  });

  it('never hands over the session cookie, which bearer answers with already', () => {
    const answered = exposeAuthCookies(answering(['better-auth.session_token=abc; Max-Age=604800']));

    expect(answered.headers.get('x-flux-set-auth-cookies')).toBeNull();
  });

  it('returns the very same answer where there is nothing to hand over', () => {
    const original = answering([]);

    expect(exposeAuthCookies(original)).toBe(original);
  });

  it('keeps the answer itself, which is what the client came for', async () => {
    const answered = exposeAuthCookies(
      new Response('{"twoFactorRedirect":true}', {
        status: 200,
        headers: [['set-cookie', 'better-auth.two_factor=abc'], ['content-type', 'application/json']],
      }),
    );

    expect(answered.status).toBe(200);
    expect(answered.headers.get('content-type')).toBe('application/json');
    await expect(answered.text()).resolves.toBe('{"twoFactorRedirect":true}');
  });

  it('keeps the cookies themselves, so a browser still gets the ones it can hold', () => {
    const answered = exposeAuthCookies(answering(['better-auth.two_factor=abc; Max-Age=600']));

    expect(answered.headers.getSetCookie()).toEqual(['better-auth.two_factor=abc; Max-Age=600']);
  });
});
