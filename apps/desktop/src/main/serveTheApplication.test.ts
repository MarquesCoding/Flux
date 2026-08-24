import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getAppPath: () => '/app' },
  net: { fetch: vi.fn() },
  protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
}));

const { askingAs, worthCarrying } = await import('./serveTheApplication');

const SERVER = 'http://localhost:8420';

describe('worthCarrying', () => {
  it('passes on what the page meant', () => {
    const sent = worthCarrying(
      new Headers({ accept: 'application/json', 'content-type': 'application/json' }),
    );

    expect(sent).toEqual({ accept: 'application/json', 'content-type': 'application/json' });
  });

  it('leaves behind what the page did not write', () => {
    expect(worthCarrying(new Headers({ 'sec-fetch-mode': 'cors' }))).toEqual({});
  });
});

describe('askingAs', () => {
  it('says the request comes from the server it is going to', () => {
    expect(askingAs(new Headers(), SERVER).origin).toBe(SERVER);
  });

  it('does not let the page speak for where the request came from', () => {
    const sent = askingAs(new Headers({ origin: 'valence://app' }), SERVER);

    expect(sent.origin).toBe(SERVER);
  });

  it('still carries what the page meant', () => {
    const sent = askingAs(new Headers({ 'content-type': 'application/json' }), SERVER);

    expect(sent['content-type']).toBe('application/json');
  });

  it('carries which face is watching, which the server reads on every request', () => {
    const sent = askingAs(new Headers({ 'x-valence-profile': 'a-profile' }), SERVER);

    expect(sent['x-valence-profile']).toBe('a-profile');
  });
});
