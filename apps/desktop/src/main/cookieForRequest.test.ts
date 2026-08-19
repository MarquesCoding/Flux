import { describe, expect, it } from 'vitest';
import { cookieForRequest } from './cookieForRequest';

const SERVER = 'https://flux.example.com';

const COOKIE = 'better-auth.session_token=abc.def';

describe('cookieForRequest', () => {
  it('signs a request to the server this client watches', () => {
    expect(cookieForRequest(`${SERVER}/api/libraries`, SERVER, COOKIE)).toBe(COOKIE);
  });

  it('signs the segment fetches a video element makes, which no script could', () => {
    expect(cookieForRequest(`${SERVER}/api/playback/abc/segment/3.m4s`, SERVER, COOKIE)).toBe(
      COOKIE,
    );
  });

  it('sends nothing to anywhere else, since a credential given away is given away', () => {
    expect(cookieForRequest('https://images.example.org/poster.jpg', SERVER, COOKIE)).toBeNull();
  });

  it('sends nothing to a host that merely looks like the server', () => {
    expect(cookieForRequest('https://flux.example.com.evil.test/x', SERVER, COOKIE)).toBeNull();
  });

  it('sends nothing over a different scheme than the one somebody named', () => {
    expect(cookieForRequest('http://flux.example.com/api/libraries', SERVER, COOKIE)).toBeNull();
  });

  it('sends nothing over a different port, which is a different server', () => {
    expect(cookieForRequest('https://flux.example.com:8420/api/x', SERVER, COOKIE)).toBeNull();
  });

  it('sends nothing before anybody has said where their Flux is', () => {
    expect(cookieForRequest(`${SERVER}/api/libraries`, '', COOKIE)).toBeNull();
  });

  it('sends nothing while nobody is signed in', () => {
    expect(cookieForRequest(`${SERVER}/api/libraries`, SERVER, '')).toBeNull();
  });

  it('sends nothing for an address that is not one', () => {
    expect(cookieForRequest('not an address', SERVER, COOKIE)).toBeNull();
  });

  it('keeps signing a Flux served under a path, which shares its origin', () => {
    expect(cookieForRequest('https://example.com/flux/api/x', 'https://example.com/flux', COOKIE)).toBe(
      COOKIE,
    );
  });
});
