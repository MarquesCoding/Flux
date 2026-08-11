import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAuth } from './createMemoryAuth';
import { ownAddresses } from '@FluxServer/env/ownOrigins';

const BASE_URL = 'http://localhost:8420';

const credentials = {
  email: 'viewer@flux.test',
  password: 'a-long-enough-password',
  name: 'Viewer',
};

const post = (path: string, body: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

/**
 * Builds auth with better-auth's test-mode relaxations turned off.
 *
 * better-auth skips trusted-origin validation when `isTest()` is true, which it
 * derives from `NODE_ENV === 'test' || TEST`. Vitest sets `TEST`, so a
 * trusted-origin assertion written the obvious way passes without ever
 * exercising the check. `NODE_ENV` is pinned to production in vitest.config.ts;
 * this clears `TEST` so the real behaviour is what gets asserted.
 */
const createProductionAuth = (overrides: Partial<NodeJS.ProcessEnv>) => {
  vi.stubEnv('TEST', '');

  return createMemoryAuth(overrides);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createAuth', () => {
  it('registers a user with email and password', async () => {
    const { auth } = createMemoryAuth();

    const response = await auth.handler(post('/api/auth/sign-up/email', credentials));

    expect(response.status).toBe(200);
  });

  it('rejects a password shorter than the configured minimum', async () => {
    const { auth } = createMemoryAuth();

    const response = await auth.handler(
      post('/api/auth/sign-up/email', { ...credentials, password: 'short' }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('signs an existing user in', async () => {
    const { auth } = createMemoryAuth();
    await auth.handler(post('/api/auth/sign-up/email', credentials));

    const response = await auth.handler(
      post('/api/auth/sign-in/email', { email: credentials.email, password: credentials.password }),
    );

    expect(response.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const { auth } = createMemoryAuth();
    await auth.handler(post('/api/auth/sign-up/email', credentials));

    const response = await auth.handler(
      post('/api/auth/sign-in/email', {
        email: credentials.email,
        password: 'wrong-password-here',
      }),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('issues a session cookie on sign in', async () => {
    const { auth } = createMemoryAuth();
    await auth.handler(post('/api/auth/sign-up/email', credentials));

    const response = await auth.handler(
      post('/api/auth/sign-in/email', { email: credentials.email, password: credentials.password }),
    );

    expect(response.headers.get('set-cookie')).toContain('session_token');
  });

  it('marks cookies insecure when the instance is served over plain http', async () => {
    const { auth } = createMemoryAuth({ COOKIE_SECURE: 'false' });
    await auth.handler(post('/api/auth/sign-up/email', credentials));

    const response = await auth.handler(
      post('/api/auth/sign-in/email', { email: credentials.email, password: credentials.password }),
    );

    expect(response.headers.get('set-cookie')).not.toContain('Secure');
  });

  it('marks cookies secure when the instance is served over tls', async () => {
    const { auth } = createMemoryAuth({
      COOKIE_SECURE: 'true',
      BETTER_AUTH_URL: 'https://flux.example',
      TRUSTED_ORIGINS: 'https://flux.example',
    });

    const response = await auth.handler(
      new Request('https://flux.example/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credentials),
      }),
    );

    expect(response.headers.get('set-cookie')).toContain('Secure');
  });

  it('accepts a bearer token as an alternative to a session cookie', async () => {
    const { auth } = createMemoryAuth();
    await auth.handler(post('/api/auth/sign-up/email', credentials));

    const signIn = await auth.handler(
      post('/api/auth/sign-in/email', { email: credentials.email, password: credentials.password }),
    );
    const token = signIn.headers.get('set-auth-token');

    expect(token).toBeTruthy();

    const session = await auth.handler(
      new Request(`${BASE_URL}/api/auth/get-session`, {
        headers: { authorization: `Bearer ${token ?? ''}` },
      }),
    );

    expect(session.status).toBe(200);
    expect(await session.text()).toContain(credentials.email);
  });

  it('gives every new user a profile row', async () => {
    const { auth, profiles } = createMemoryAuth();

    await auth.handler(post('/api/auth/sign-up/email', credentials));

    expect(profiles).toHaveLength(1);
  });

  it('produces a recovery link when someone forgets their password', async () => {
    const { auth, resetLinks } = createMemoryAuth();
    await auth.handler(post('/api/auth/sign-up/email', credentials));

    const response = await auth.handler(
      post('/api/auth/request-password-reset', {
        email: credentials.email,
        redirectTo: `${BASE_URL}/reset`,
      }),
    );

    expect(response.status).toBe(200);
    expect(resetLinks[0]?.email).toBe(credentials.email);
    expect(resetLinks[0]?.url).toContain('reset-password');
    expect((resetLinks[0]?.url ?? '').length).toBeGreaterThan(BASE_URL.length + 20);
  });

  it('does not reveal whether an address has an account', async () => {
    const { auth, resetLinks } = createMemoryAuth();

    const response = await auth.handler(
      post('/api/auth/request-password-reset', {
        email: 'nobody@flux.test',
        redirectTo: `${BASE_URL}/reset`,
      }),
    );

    expect(response.status).toBe(200);
    expect(resetLinks).toHaveLength(0);
  });

  it('exposes a jwks endpoint for native clients to verify tokens', async () => {
    const { auth } = createMemoryAuth();

    const response = await auth.handler(new Request(`${BASE_URL}/api/auth/jwks`));

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty('keys');
  });

  it('exposes the device authorization endpoint for keyboard-less clients', async () => {
    const { auth } = createMemoryAuth();

    const response = await auth.handler(post('/api/auth/device/code', { client_id: 'flux-tv' }));

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toHaveProperty('device_code');
    expect(body).toHaveProperty('user_code');
  });

  it('refuses to redirect to an untrusted origin', async () => {
    const { auth } = createProductionAuth({ TRUSTED_ORIGINS: 'http://localhost:8420' });

    const response = await auth.handler(
      post('/api/auth/sign-up/email', { ...credentials, callbackURL: 'http://evil.example/steal' }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'INVALID_CALLBACK_URL' });
  });

  it('allows a redirect to an address this machine actually answers on', async () => {
    // Nobody configured this one. A self-hosted server is reached from the
    // sofa at whatever address the router handed out, and being refused there
    // with nothing but a failed sign-in is the most tedious way for this to
    // appear broken.
    const [own] = ownAddresses();

    if (own === undefined) {
      return;
    }

    const { auth } = createProductionAuth({ TRUSTED_ORIGINS: 'http://localhost:8420' });

    const response = await auth.handler(
      post('/api/auth/sign-up/email', {
        ...credentials,
        callbackURL: `http://${own}:8420/library`,
      }),
    );

    expect(response.status).toBe(200);
  });

  it('allows a redirect to a configured trusted origin', async () => {
    const { auth } = createProductionAuth({
      TRUSTED_ORIGINS: 'http://localhost:8420,http://192.168.1.40:8420',
    });

    const response = await auth.handler(
      post('/api/auth/sign-up/email', {
        ...credentials,
        callbackURL: 'http://192.168.1.40:8420/library',
      }),
    );

    expect(response.status).toBe(200);
  });
});
