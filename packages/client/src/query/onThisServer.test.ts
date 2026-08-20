import { afterEach, describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { onThisServer } from './onThisServer';

const watching = (server: string): void => {
  forgetPlatform();
  installPlatform({ ...aFakePlatform(), whereTheServerIs: () => server });
};

afterEach(() => {
  forgetPlatform();
});

describe('onThisServer', () => {
  it('puts a path the server gave us onto the server it came from', () => {
    watching('https://flux.example.com');

    expect(onThisServer('/api/playback/session/abc/index.m3u8')).toBe(
      'https://flux.example.com/api/playback/session/abc/index.m3u8',
    );
  });

  it('leaves a browser resolving it against the page, which came from the server', () => {
    watching('');

    expect(onThisServer('/api/playback/session/abc/index.m3u8')).toBe(
      '/api/playback/session/abc/index.m3u8',
    );
  });

  it('leaves an absolute address alone, which the server chose on purpose', () => {
    watching('https://flux.example.com');

    expect(onThisServer('https://cdn.example.org/a/file.m3u8')).toBe(
      'https://cdn.example.org/a/file.m3u8',
    );
  });

  it('leaves anything that is not a path alone rather than guessing at it', () => {
    watching('https://flux.example.com');

    expect(onThisServer('blob:abc-123')).toBe('blob:abc-123');
  });
});
