import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readClientId } from './clientIdentity';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Takes `randomUUID` away, as a browser does on a page that is not a secure
 * context.
 *
 * Shadowed on the instance rather than deleted, because the method lives on
 * `Crypto.prototype` — deleting the own property removes nothing and leaves the
 * test passing against code that never had the fix. Deleting that shadow
 * afterwards is what puts the real method back.
 */
const withoutRandomUUID = (): void => {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: undefined,
  });
};

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(crypto, 'randomUUID');
});

describe('readClientId', () => {
  it('makes an id for a tab that has none yet', () => {
    expect(readClientId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps the same id across calls in the same tab', () => {
    expect(readClientId()).toBe(readClientId());
  });

  it('still answers when storage is refused, just without remembering it', () => {
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    expect(() => readClientId()).not.toThrow();
  });

  it('makes an id where the page is not a secure context', () => {
    withoutRandomUUID();

    expect(readClientId()).toMatch(UUID_V4);
  });

  it('keeps that id too, so presence does not rename the tab on every call', () => {
    withoutRandomUUID();

    expect(readClientId()).toBe(readClientId());
  });

  it('answers where there is neither a secure context nor storage', () => {
    withoutRandomUUID();
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    expect(readClientId()).toMatch(UUID_V4);
  });
});
