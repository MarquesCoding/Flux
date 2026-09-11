import { describe, expect, it } from 'vitest';
import { titleLogoUrl } from './titleLogoUrl';

describe('titleLogoUrl', () => {
  it('names where an item’s logo is served from', () => {
    expect(titleLogoUrl('abc')).toMatch(/^\/api\/media\/abc\/image\/logo/);
  });

  it('marks it as the full-size logo, so a browser holding the smaller one asks again', () => {
    expect(titleLogoUrl('abc')).toBe('/api/media/abc/image/logo?at=full');
  });
});
