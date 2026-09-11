import { describe, expect, it } from 'vitest';
import { isAppAddress } from './isAppAddress';

describe('isAppAddress', () => {
  it('gives the application the address it was opened at', () => {
    expect(isAppAddress('/')).toBe(true);
  });

  it('gives the application a page only it knows how to draw', () => {
    expect(isAppAddress('/library/3f2504e0')).toBe(true);
    expect(isAppAddress('/settings/account')).toBe(true);
  });

  it('leaves the API to answer for itself, rather than handing back a page', () => {
    expect(isAppAddress('/api/media/3f2504e0')).toBe(false);
    expect(isAppAddress('/api')).toBe(false);
  });

  it('does not dress a missing file up as a page', () => {
    expect(isAppAddress('/assets/index-a1b2c3.js')).toBe(false);
    expect(isAppAddress('/icon.png')).toBe(false);
    expect(isAppAddress('/push-worker.js')).toBe(false);
  });

  it('is not fooled by a page whose name merely contains the API', () => {
    expect(isAppAddress('/apiary')).toBe(true);
  });
});
