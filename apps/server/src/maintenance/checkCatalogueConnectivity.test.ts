import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkCatalogueConnectivity } from './checkCatalogueConnectivity';
describe('checkCatalogueConnectivity', () => {
  it('is unreachable when no key is configured', async () => {
    const reachable = await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve(null),
      fetchImpl: () => Promise.reject(new Error('should not be called')),
    });

    expect(reachable).toBe(false);
  });

  it('sends an older key as a query parameter', async () => {
    let seenUrl = '';

    await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('a1b2c3'),
      fetchImpl: (url) => {
        seenUrl = url;

        return Promise.resolve({ ok: true, status: 200 });
      },
    });

    expect(seenUrl).toContain('api_key=a1b2c3');
  });

  it('sends a newer access token as a bearer header', async () => {
    let seenHeaders: Record<string, string> | undefined;

    await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('eyabc.def.ghi'),
      fetchImpl: (_url, headers) => {
        seenHeaders = headers;

        return Promise.resolve({ ok: true, status: 200 });
      },
    });

    expect(seenHeaders).toEqual({ authorization: 'Bearer eyabc.def.ghi' });
  });

  it('is reachable when the catalogue answers ok', async () => {
    const reachable = await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('a-key'),
      fetchImpl: () => Promise.resolve({ ok: true, status: 200 }),
    });

    expect(reachable).toBe(true);
  });

  it('is unreachable when the catalogue refuses the key', async () => {
    const reachable = await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('a-bad-key'),
      fetchImpl: () => Promise.resolve({ ok: false, status: 401 }),
    });

    expect(reachable).toBe(false);
  });

  it('is unreachable rather than throwing when the catalogue cannot be reached at all', async () => {
    const reachable = await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('a-key'),
      fetchImpl: () => Promise.reject(new Error('network down')),
    });

    expect(reachable).toBe(false);
  });
});

describe('reaching the catalogue over the network itself', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the catalogue directly where nothing else was supplied to ask with', async () => {
    const asked: { url: string; init?: object }[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: object) => {
        asked.push({ url, ...(init === undefined ? {} : { init }) });

        return Promise.resolve({ ok: true, status: 200 });
      }),
    );

    await expect(
      checkCatalogueConnectivity({ readApiKey: () => Promise.resolve('a-key') }),
    ).resolves.toBe(true);

    expect(asked[0]?.url).toContain('api_key=a-key');
  });

  it('carries the bearer token as a header where the key is one', async () => {
    const asked: { url: string; init?: { headers?: Record<string, string> } }[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: { headers?: Record<string, string> }) => {
        asked.push({ url, ...(init === undefined ? {} : { init }) });

        return Promise.resolve({ ok: true, status: 200 });
      }),
    );

    await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve(`eyJ${'a'.repeat(40)}.${'b'.repeat(40)}.${'c'.repeat(40)}`),
    });

    expect(asked[0]?.init?.headers).toBeDefined();
  });
});
