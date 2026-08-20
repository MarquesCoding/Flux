import { describe, expect, it } from 'vitest';
import { asCookiePairs } from './asCookiePairs';

describe('asCookiePairs', () => {
  it('reads the name and value the server set', () => {
    expect(asCookiePairs(['s=abc; Path=/; HttpOnly; SameSite=Lax'])).toEqual([
      { name: 's', value: 'abc', expiresAt: null },
    ]);
  });

  it('keeps how long the server means it to last, or somebody signs in at every launch', () => {
    const [kept] = asCookiePairs(['s=abc; Max-Age=604800']);
    const aWeekFromNow = Date.now() / 1000 + 604800;

    expect(kept?.expiresAt).toBeGreaterThan(aWeekFromNow - 5);
    expect(kept?.expiresAt).toBeLessThan(aWeekFromNow + 5);
  });

  it('reads a date where the server gave one instead', () => {
    expect(asCookiePairs(['s=abc; Expires=Wed, 27 Aug 2026 00:00:00 GMT'])[0]?.expiresAt).toBe(
      Date.parse('2026-08-27T00:00:00Z') / 1000,
    );
  });

  it('prefers the age over the date, which is what the specification says', () => {
    const [kept] = asCookiePairs(['s=abc; Expires=Wed, 27 Aug 2026 00:00:00 GMT; Max-Age=60']);

    expect(kept?.expiresAt).toBeGreaterThan(Date.now() / 1000);
    expect(kept?.expiresAt).toBeLessThan(Date.now() / 1000 + 120);
  });

  it('says nothing about a lifetime the server did not give, which lasts the session', () => {
    expect(asCookiePairs(['s=abc; Path=/'])[0]?.expiresAt).toBeNull();
  });

  it('says nothing for a date it cannot read, rather than an expiry in 1970', () => {
    expect(asCookiePairs(['s=abc; Expires=not a date'])[0]?.expiresAt).toBeNull();
  });

  it('throws the attributes away, since this cookie is kept under attributes of our own', () => {
    expect(asCookiePairs(['s=abc; Secure; Path=/x'])[0]).toMatchObject({
      name: 's',
      value: 'abc',
    });
  });

  it('reads several, which is what verifying a second factor answers with', () => {
    expect(asCookiePairs(['a=1; Path=/', 'b=2; Path=/'])).toEqual([
      { name: 'a', value: '1', expiresAt: null },
      { name: 'b', value: '2', expiresAt: null },
    ]);
  });

  it('keeps a signed value exactly as it was, since rewriting one stops it verifying', () => {
    expect(asCookiePairs(['n=abc.d-e_f%3D; Path=/'])[0]?.value).toBe('abc.d-e_f%3D');
  });

  it('keeps an equals sign inside a value, which base64 puts there', () => {
    expect(asCookiePairs(['n=a=b'])[0]).toMatchObject({ name: 'n', value: 'a=b' });
  });

  it('reads an emptied one as empty, so the caller can let go of it', () => {
    expect(asCookiePairs(['s=; Max-Age=0'])[0]).toMatchObject({ name: 's', value: '' });
  });

  it('drops a line that names nothing', () => {
    expect(asCookiePairs(['', 'nonsense', '=b'])).toEqual([]);
  });
});
