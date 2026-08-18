import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readVersion, describeVersion, LOCAL } from './readVersion';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const answerWith = (body: JsonValue, ok = true) => {
  fetchMock.mockResolvedValue({ ok, json: () => Promise.resolve(body) });
};

describe('describeVersion', () => {
  it('says a released version as it is', () => {
    expect(describeVersion('1.4.2')).toBe('1.4.2');
  });

  it('says a build that was never released is a local one', () => {
    expect(describeVersion('0.0.0')).toBe(LOCAL);
    expect(describeVersion('dev')).toBe(LOCAL);
    expect(describeVersion('')).toBe(LOCAL);
  });

  it('does not let surrounding space hide an unreleased version', () => {
    expect(describeVersion('  0.0.0 ')).toBe(LOCAL);
  });
});

describe('readVersion', () => {
  it('asks the server rather than trusting the page it came from', async () => {
    answerWith({ version: '1.4.2' });

    await readVersion();

    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('reports what the server is running', async () => {
    answerWith({ version: '1.4.2' });

    await expect(readVersion()).resolves.toBe('1.4.2');
  });

  it('describes an unreleased build rather than printing a nought', async () => {
    answerWith({ version: '0.0.0' });

    await expect(readVersion()).resolves.toBe(LOCAL);
  });

  it('says so when the answer is not the shape it was promised', async () => {
    answerWith({}, false);

    await expect(readVersion()).rejects.toThrow();
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(readVersion()).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    answerWith({ nothing: true });

    await expect(readVersion()).rejects.toThrow();
  });
});
