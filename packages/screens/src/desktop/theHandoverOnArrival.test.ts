import { afterEach, describe, expect, it, vi } from 'vitest';

const HANDOVER = '?client_id=electron&code_challenge=a-challenge&state=a-state';

const arrivingAt = async (search: string) => {
  window.history.replaceState({}, '', `/${search}`);
  vi.resetModules();

  const { theHandoverOnArrival } = await import('./theHandoverOnArrival');

  return theHandoverOnArrival();
};

afterEach(() => {
  window.history.replaceState({}, '', '/');
  vi.resetModules();
});

describe('theHandoverOnArrival', () => {
  it('reads what a desktop client sent somebody here with', async () => {
    await expect(arrivingAt(HANDOVER)).resolves.toEqual({
      client_id: 'electron',
      code_challenge: 'a-challenge',
      state: 'a-state',
    });
  });

  it('answers with nothing where somebody simply opened Flux', async () => {
    await expect(arrivingAt('')).resolves.toBeNull();
  });

  it('answers with nothing for an address carrying something else entirely', async () => {
    await expect(arrivingAt('?library=abc')).resolves.toBeNull();
  });

  it('keeps answering after the router has rewritten the address, which it does at once', async () => {
    const { theHandoverOnArrival } = await (async () => {
      window.history.replaceState({}, '', `/${HANDOVER}`);
      vi.resetModules();

      return import('./theHandoverOnArrival');
    })();

    window.history.replaceState({}, '', '/?library=abc');

    expect(theHandoverOnArrival()).toMatchObject({ state: 'a-state' });
  });
});
