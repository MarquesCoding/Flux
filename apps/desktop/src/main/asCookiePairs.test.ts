import { describe, expect, it } from 'vitest';
import { asCookiePairs } from './asCookiePairs';

describe('asCookiePairs', () => {
  it('reads the name and value the server set', () => {
    expect(asCookiePairs(['s=abc; Path=/; HttpOnly; SameSite=Lax'])).toEqual([
      { name: 's', value: 'abc' },
    ]);
  });

  it('throws the attributes away, since this cookie is kept under attributes of our own', () => {
    expect(asCookiePairs(['s=abc; Max-Age=600; Secure'])[0]).toEqual({ name: 's', value: 'abc' });
  });

  it('reads several, which is what verifying a second factor answers with', () => {
    expect(asCookiePairs(['a=1; Path=/', 'b=2; Path=/'])).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
  });

  it('keeps a signed value exactly as it was, since rewriting one stops it verifying', () => {
    expect(asCookiePairs(['n=abc.d-e_f%3D; Path=/'])[0]?.value).toBe('abc.d-e_f%3D');
  });

  it('keeps an equals sign inside a value, which base64 puts there', () => {
    expect(asCookiePairs(['n=a=b'])[0]).toEqual({ name: 'n', value: 'a=b' });
  });

  it('reads an emptied one as empty, so the caller can let go of it', () => {
    expect(asCookiePairs(['s=; Max-Age=0'])).toEqual([{ name: 's', value: '' }]);
  });

  it('drops a line that names nothing', () => {
    expect(asCookiePairs(['', 'nonsense', '=b'])).toEqual([]);
  });
});
