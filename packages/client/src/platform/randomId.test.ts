import { afterEach, describe, expect, it } from 'vitest';
import { randomId } from './randomId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Takes `randomUUID` away, as a browser does on a page that is not a secure context.
 *
 * Shadowed on the instance rather than deleted, because the method lives on `Crypto.prototype` —
 * deleting the own property removes nothing and leaves the test passing against code that never had
 * the fix. Deleting that shadow afterwards is what puts the real method back.
 */
const withoutRandomUUID = (): void => {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: undefined,
  });
};

afterEach(() => {
  Reflect.deleteProperty(crypto, 'randomUUID');
});

describe('randomId', () => {
  it('answers with an identifier', () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  it('answers with a different one each time', () => {
    expect(randomId()).not.toBe(randomId());
  });

  it('answers where the page is not a secure context, which a plain LAN address is not', () => {
    withoutRandomUUID();

    expect(randomId()).toMatch(UUID_V4);
  });

  it('assembles the version and variant itself where it has to', () => {
    withoutRandomUUID();

    expect(randomId()).not.toBe(randomId());
  });
});
