import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSetupStatus } from './fetchSetupStatus';

const fetchMock = vi.fn();

const said = (body: object, ok = true, status = 200) => ({
  ok,
  status,
  json: () => Promise.resolve(body),
});

const COMPLETE = {
  isComplete: true,
  detectedOrigin: 'http://local.dev',
  isSecureContext: true,
  suggestedTrustedOrigins: [],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSetupStatus', () => {
  it('asks the server whether it has been set up', async () => {
    fetchMock.mockResolvedValue(said(COMPLETE));

    await expect(fetchSetupStatus()).resolves.toMatchObject({ isComplete: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/setup/status', {
      headers: { accept: 'application/json' },
    });
  });

  it('refuses to guess when the server did not answer properly', async () => {
    fetchMock.mockResolvedValue(said({}, false, 500));

    await expect(fetchSetupStatus()).rejects.toThrow(/500/);
  });

  it('refuses an answer that is not one', async () => {
    fetchMock.mockResolvedValue(said({ ...COMPLETE, isComplete: 'yes' }));

    await expect(fetchSetupStatus()).rejects.toThrow();
  });
});
