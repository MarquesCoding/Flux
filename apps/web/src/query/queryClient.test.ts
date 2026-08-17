import { describe, expect, it } from 'vitest';
import { buildQueryClient } from './queryClient';

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
    const client = buildQueryClient();

    expect(client.getDefaultOptions().queries?.retry).toBeGreaterThan(0);
    expect(client.getDefaultOptions().mutations?.retry).toBe(0);
  });

  it('gives each caller a cache of its own', () => {
    expect(buildQueryClient()).not.toBe(buildQueryClient());
  });
});
