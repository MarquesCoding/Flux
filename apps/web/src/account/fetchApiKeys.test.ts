import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApiKeys, createApiKey, setApiKeyEnabled, revokeApiKey } from './fetchApiKeys';

const KEY = {
  id: 'key-1',
  name: 'Home Assistant',
  start: 'flux_abc',
  enabled: true,
  expiresAt: null,
  lastRequestAt: null,
  requestCount: 0,
  permissions: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const answers = (body: object, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

/**
 * What was sent as the body of the one request made.
 *
 * Read back as text rather than trusted to stringify: `fetch` takes a body of
 * several shapes and only one of them says anything useful when coerced.
 */
const bodySent = (sent: ReturnType<typeof answers>): string => {
  const body = sent.mock.calls[0]?.[1]?.body;

  return typeof body === 'string' ? body : '';
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchApiKeys', () => {
  it('reads the keys on this account', async () => {
    answers({ keys: [KEY] });

    expect(await fetchApiKeys()).toHaveLength(1);
  });

  it('answers with nothing when the account may not hold keys', async () => {
    answers({ error: 'nope' }, 403);

    expect(await fetchApiKeys()).toBeNull();
  });

  it('answers with nothing rather than throwing when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    expect(await fetchApiKeys()).toBeNull();
  });

  it('answers with nothing rather than trusting a shape it did not expect', async () => {
    answers({ keys: [{ id: 'key-1' }] });

    expect(await fetchApiKeys()).toBeNull();
  });
});

describe('createApiKey', () => {
  it('answers with the key at the one moment it can be read', async () => {
    answers({ ...KEY, key: 'flux_secret' }, 201);

    expect((await createApiKey({ name: 'A', expiresInDays: null, permissions: null }))?.key).toBe(
      'flux_secret',
    );
  });

  it('sends what it was asked for', async () => {
    const sent = answers({ ...KEY, key: 'flux_secret' }, 201);

    await createApiKey({ name: 'A', expiresInDays: 30, permissions: ['jobs.run'] });

    expect(bodySent(sent)).toContain('"expiresInDays":30');
    expect(bodySent(sent)).toContain('jobs.run');
  });

  it('answers with nothing when the server refuses', async () => {
    answers({ error: 'nope' }, 403);

    expect(await createApiKey({ name: 'A', expiresInDays: null, permissions: null })).toBeNull();
  });
});

describe('turning a key off and revoking it', () => {
  it('reports that a key was turned off', async () => {
    answers(KEY);

    expect(await setApiKeyEnabled('key-1', false)).toBe(true);
  });

  it('reports a refusal rather than pretending it worked', async () => {
    answers({ error: 'nope' }, 404);

    expect(await setApiKeyEnabled('key-1', false)).toBe(false);
    expect(await revokeApiKey('key-1')).toBe(false);
  });

  it('reports that a key was revoked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    expect(await revokeApiKey('key-1')).toBe(true);
  });
});
