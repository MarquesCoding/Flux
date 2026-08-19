import { describe, expect, it } from 'vitest';
import { headersForUpgrade } from './headersForUpgrade';

describe('headersForUpgrade', () => {
  it('turns a token from the address into the header the session lookup reads', () => {
    const carried = headersForUpgrade(new Headers(), 'a-session-token');

    expect(carried.get('authorization')).toBe('Bearer a-session-token');
  });

  it('leaves a request carrying a cookie exactly as it was', () => {
    const cookie = new Headers({ cookie: 'flux.session=abc' });
    const carried = headersForUpgrade(cookie, undefined);

    expect(carried.get('authorization')).toBeNull();
    expect(carried.get('cookie')).toBe('flux.session=abc');
  });

  it('treats an empty token as none, rather than as an empty bearer', () => {
    expect(headersForUpgrade(new Headers(), '').get('authorization')).toBeNull();
  });

  it('does not overwrite a header the request already carried', () => {
    const already = new Headers({ authorization: 'Bearer the-real-one' });

    expect(headersForUpgrade(already, 'from-the-address').get('authorization')).toBe(
      'Bearer the-real-one',
    );
  });

  it('keeps everything else the upgrade carried', () => {
    const original = new Headers({ cookie: 'flux.session=abc', 'user-agent': 'Flux on macOS' });
    const carried = headersForUpgrade(original, 'a-session-token');

    expect(carried.get('cookie')).toBe('flux.session=abc');
    expect(carried.get('user-agent')).toBe('Flux on macOS');
  });

  it('leaves the headers it was given alone, since a request is not ours to change', () => {
    const original = new Headers();

    headersForUpgrade(original, 'a-session-token');

    expect(original.get('authorization')).toBeNull();
  });
});
