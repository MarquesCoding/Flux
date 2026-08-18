import { describe, expect, it } from 'vitest';
import { rememberGuestFor } from './rememberGuestFor';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const FALLBACK = 30 * 86_400;

describe('rememberGuestFor', () => {
  it('remembers somebody holding an endless link for the fallback', () => {
    expect(rememberGuestFor(null, NOW, FALLBACK)).toBe(FALLBACK);
  });

  it('remembers them for as long as the link lasts, so tomorrow still works', () => {
    const tomorrow = new Date('2026-08-19T12:00:00.000Z');

    expect(rememberGuestFor(tomorrow, NOW, FALLBACK)).toBe(86_400);
  });

  it('never remembers them longer than the link, however long that is', () => {
    const soon = new Date('2026-08-18T12:00:30.000Z');

    expect(rememberGuestFor(soon, NOW, FALLBACK)).toBe(30);
  });

  it('remembers a link that outlasts the fallback for as long as it actually lasts', () => {
    const ages = new Date('2027-08-18T12:00:00.000Z');

    expect(rememberGuestFor(ages, NOW, FALLBACK)).toBeGreaterThan(FALLBACK);
  });

  it('never asks for nothing, which would throw the cookie away on arrival', () => {
    expect(rememberGuestFor(NOW, NOW, FALLBACK)).toBe(1);
    expect(rememberGuestFor(new Date('2020-01-01T00:00:00.000Z'), NOW, FALLBACK)).toBe(1);
  });
});
