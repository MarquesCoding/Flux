import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { allowCrossOriginClients } from './allowCrossOriginClients';

const TRUSTED = ['https://localhost:5173'];

const served = (trusted: readonly string[] = TRUSTED) => {
  const app = new Hono();

  app.use('/api/*', allowCrossOriginClients({ trustedOrigins: () => Promise.resolve(trusted) }));
  app.get('/api/health', (context) => context.json({ status: 'ok' }));

  return app;
};

const askedFrom = (origin: string | null, method = 'GET') =>
  served().request('/api/health', {
    method,
    ...(origin === null ? {} : { headers: { origin } }),
  });

describe('allowCrossOriginClients', () => {
  it('lets a named origin read the answer', async () => {
    const response = await askedFrom('https://localhost:5173');

    expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost:5173');
  });

  it('allows credentials, without which the engine discards the reply anyway', async () => {
    const response = await askedFrom('https://localhost:5173');

    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('exposes the header better-auth hands a token back in', async () => {
    const response = await askedFrom('https://localhost:5173');

    expect(response.headers.get('access-control-expose-headers')).toContain('set-auth-token');
  });

  it('exposes what a player needs to seek, since range replies are read the same way', async () => {
    const response = await askedFrom('https://localhost:5173');

    expect(response.headers.get('access-control-expose-headers')).toContain('content-range');
  });

  it('lets the desktop client read the answer without anybody configuring it', async () => {
    const response = await served([]).request('/api/health', {
      headers: { origin: 'tauri://localhost' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('tauri://localhost');
  });

  it('says nothing to an origin nobody named, so the engine hides the answer', async () => {
    const response = await askedFrom('https://somewhere.else');

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('leaves a same-origin request untouched', async () => {
    const response = await askedFrom(null);

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('answers a preflight before anything else looks at it', async () => {
    const response = await served().request('/api/health', {
      method: 'OPTIONS',
      headers: { origin: 'https://localhost:5173' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toContain('DELETE');
    expect(response.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('turns away a preflight from an origin nobody named', async () => {
    const response = await served().request('/api/health', {
      method: 'OPTIONS',
      headers: { origin: 'https://somewhere.else' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('lets a client send back the cookies it is holding, which a preflight has to allow', async () => {
    const response = await served().request('/api/health', {
      method: 'OPTIONS',
      headers: { origin: 'https://localhost:5173' },
    });

    expect(response.headers.get('access-control-allow-headers')).toContain('x-flux-auth-cookies');
  });

  it('lets a client read the cookies it is being handed, which it cannot be sent', async () => {
    const response = await askedFrom('https://localhost:5173');

    expect(response.headers.get('access-control-expose-headers')).toContain(
      'x-flux-set-auth-cookies',
    );
  });

  it('varies on origin, so one client is not served another client answer', async () => {
    const response = await askedFrom('https://localhost:5173');

    expect(response.headers.get('vary')).toContain('Origin');
  });
});
