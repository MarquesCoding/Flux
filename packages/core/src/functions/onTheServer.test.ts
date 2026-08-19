import { describe, expect, it } from 'vitest';
import { onTheServer, PLACEHOLDER_ORIGIN } from './onTheServer';

describe('onTheServer', () => {
  it('puts the path on the server the client watches', () => {
    expect(onTheServer('https://flux.example.com', '/api/auth/get-session')).toBe(
      'https://flux.example.com/api/auth/get-session',
    );
  });

  it('takes the path off an address the library made up', () => {
    expect(onTheServer('https://flux.example.com', `${PLACEHOLDER_ORIGIN}/api/auth/ok`)).toBe(
      'https://flux.example.com/api/auth/ok',
    );
  });

  it('keeps the query, which is where the library says what it is asking about', () => {
    expect(onTheServer('https://flux.example.com', '/api/auth/list?take=5')).toBe(
      'https://flux.example.com/api/auth/list?take=5',
    );
  });

  it('leaves a browser asking the page it was served, which is a relative path', () => {
    expect(onTheServer('', '/api/auth/get-session')).toBe('/api/auth/get-session');
  });

  it('drops a trailing slash rather than reaching a doubled one', () => {
    expect(onTheServer('https://flux.example.com/', '/api/health')).toBe(
      'https://flux.example.com/api/health',
    );
  });

  it('keeps a path, for a Flux served under one', () => {
    expect(onTheServer('https://example.com/flux', '/api/health')).toBe(
      'https://example.com/flux/api/health',
    );
  });
});
