import { describe, expect, it, vi } from 'vitest';
import type { QueryKey } from '@tanstack/react-query';
import { buildQueryClient } from './queryClient';
import { RequestFailed } from './RequestFailed';

/**
 * Asks the cache's own rule whether it would try again.
 *
 * @param error - What the read failed with.
 * @param failureCount - How many times it has failed already.
 * @returns Whether it would be tried again.
 */
const wouldRetry = (error: Error, failureCount = 0): boolean => {
  const rule = buildQueryClient().getDefaultOptions().queries?.retry;

  return typeof rule === 'function' && rule(failureCount, error) === true;
};

describe('buildQueryClient', () => {
  it('holds an answer long enough that leaving a page and coming back does not ask again', () => {
    const held = buildQueryClient().getDefaultOptions().queries;

    expect(held?.staleTime).toBeGreaterThan(0);
    expect(held?.gcTime).toBeGreaterThan(60_000);
  });

  it('asks again when the tab is looked at and when the network comes back', () => {
    const held = buildQueryClient().getDefaultOptions().queries;

    expect(held?.refetchOnWindowFocus).toBe(true);
    expect(held?.refetchOnReconnect).toBe(true);
  });

  it('tries a failed read again, and never tries a change again', () => {
    expect(wouldRetry(new Error('the server is down'))).toBe(true);
    expect(buildQueryClient().getDefaultOptions().mutations?.retry).toBe(0);
  });

  it('gives up once it has tried as often as it means to', () => {
    expect(wouldRetry(new Error('the server is down'), 2)).toBe(false);
  });

  it('does not ask again for something the server has already refused', () => {
    for (const status of [400, 401, 403, 404, 405, 409, 422]) {
      expect(wouldRetry(new RequestFailed('/api/profiles', status))).toBe(false);
    }
  });

  it('does ask again where the server merely fell over, since that may pass', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(wouldRetry(new RequestFailed('/api/profiles', status))).toBe(true);
    }
  });

  /**
   * Runs a read that fails, the way a screen's would, and answers with what the cache did about it.
   *
   * @param status - What the server refused with.
   * @returns The keys the cache decided to re-read.
   */
  const afterFailing = async (status: number): Promise<(QueryKey | undefined)[]> => {
    const client = buildQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await client
      .fetchQuery({
        queryKey: ['probe'],
        queryFn: () => Promise.reject(new RequestFailed('/api/profiles', status)),
        retry: false,
      })
      .catch(() => null);

    return invalidate.mock.calls.map((call) => call[0]?.queryKey);
  };

  it('re-reads who is signed in when something is refused, and only that', async () => {
    await expect(afterFailing(401)).resolves.toEqual([['session', 'who']]);
  });

  it('leaves a refusal that is not about the session alone', async () => {
    await expect(afterFailing(500)).resolves.toEqual([]);
  });

  it('gives each caller a cache of its own', () => {
    expect(buildQueryClient()).not.toBe(buildQueryClient());
  });
});
