import { afterEach, describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { serverUrl } from './serverUrl';

const watching = (server: string) => {
  installPlatform({ ...aFakePlatform(), whereTheServerIs: () => server });
};

afterEach(() => {
  forgetPlatform();
});

describe('serverUrl', () => {
  it('leaves a path alone where the client came from the server itself', () => {
    watching('');

    expect(serverUrl('/api/shares')).toBe('/api/shares');
  });

  it('puts the path on the server a client with a window of its own was told about', () => {
    watching('https://flux.example.com');

    expect(serverUrl('/api/shares')).toBe('https://flux.example.com/api/shares');
  });

  it('does not double the slash where the address was given with a trailing one', () => {
    watching('https://flux.example.com/');

    expect(serverUrl('/api/shares')).toBe('https://flux.example.com/api/shares');
  });

  it('tolerates an address given with several trailing slashes', () => {
    watching('https://flux.example.com///');

    expect(serverUrl('/api/shares')).toBe('https://flux.example.com/api/shares');
  });

  it('keeps a port, which a client on a local network will have been given one of', () => {
    watching('http://192.168.1.20:8420');

    expect(serverUrl('/api/media/abc/image/poster')).toBe(
      'http://192.168.1.20:8420/api/media/abc/image/poster',
    );
  });

  it('refuses to guess where nothing has been installed at all', () => {
    forgetPlatform();

    expect(() => serverUrl('/api/shares')).toThrow();
  });
});
