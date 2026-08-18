import { describe, expect, it } from 'vitest';
import { scrollKeyOf } from './scrollKeyOf';

/**
 * An address, as much of one as this reads.
 *
 * @param pathname - The path.
 * @param searchStr - The query string, leading question mark and all.
 * @returns Somewhere the router could be.
 */
const at = (pathname: string, searchStr = '') => ({ pathname, searchStr });

describe('scrollKeyOf', () => {
  it('gives a page and the same page with a dialog over it one key', () => {
    expect(scrollKeyOf(at('/', '?item=tt42'))).toBe(scrollKeyOf(at('/')));
  });

  it('treats every kind of overlay the same way, since all of them sit over the page', () => {
    for (const overlay of ['item=tt42', 'show=s1', 'person=7', 'party=abc']) {
      expect(scrollKeyOf(at('/', `?${overlay}`))).toBe('/');
    }
  });

  it('keeps somewhere genuinely else apart, so its own scroll is remembered', () => {
    expect(scrollKeyOf(at('/search', '?q=alien'))).toBe('/search?q=alien');
    expect(scrollKeyOf(at('/search', '?q=alien'))).not.toBe(scrollKeyOf(at('/search', '?q=blade')));
  });

  it('keeps what is left of an address when only part of it was an overlay', () => {
    expect(scrollKeyOf(at('/search', '?q=alien&item=tt42'))).toBe('/search?q=alien');
  });

  it('tells two paths apart even where neither carries a query', () => {
    expect(scrollKeyOf(at('/admin'))).not.toBe(scrollKeyOf(at('/account')));
  });
});
