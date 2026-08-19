import { describe, expect, it } from 'vitest';
import { asCookiePairs } from './asCookiePairs';

describe('asCookiePairs', () => {
  it('reads a name and a value', () => {
    expect(asCookiePairs(['a=b'])).toEqual([{ name: 'a', value: 'b' }]);
  });

  it('ignores the space a cookie header puts after the semicolon', () => {
    expect(asCookiePairs(' a=b '.split(','))).toEqual([{ name: 'a', value: 'b' }]);
  });

  it('keeps a signed value exactly as it was, since rewriting one stops it verifying', () => {
    expect(asCookiePairs(['n=abc.d-e_f%3D'])[0]?.value).toBe('abc.d-e_f%3D');
  });

  it('keeps an equals sign inside a value, which base64 puts there', () => {
    expect(asCookiePairs(['n=a=b'])).toEqual([{ name: 'n', value: 'a=b' }]);
  });

  it('reads a cookie that has been emptied, which is how one is told to go', () => {
    expect(asCookiePairs(['n='])).toEqual([{ name: 'n', value: '' }]);
  });

  it('drops a text with no equals sign at all', () => {
    expect(asCookiePairs(['nonsense'])).toEqual([]);
  });

  it('drops a text with nothing before the equals sign, which names nothing', () => {
    expect(asCookiePairs(['=b'])).toEqual([]);
  });

  it('keeps the order it was given, so the last word on a name is still the last', () => {
    expect(asCookiePairs(['a=1', 'b=2', 'a=3']).map(({ value }) => value)).toEqual(['1', '2', '3']);
  });
});
