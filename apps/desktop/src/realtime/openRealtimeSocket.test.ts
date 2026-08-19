import { describe, expect, it } from 'vitest';
import { socketAddressOf } from './openRealtimeSocket';

describe('socketAddressOf', () => {
  it('opens a plain socket against a server reached without TLS', () => {
    expect(socketAddressOf('http://192.168.1.20:8420')).toBe(
      'ws://192.168.1.20:8420/api/realtime',
    );
  });

  it('opens a secure socket against a server reached over TLS, which refuses a plain one', () => {
    expect(socketAddressOf('https://flux.example.com')).toBe(
      'wss://flux.example.com/api/realtime',
    );
  });

  it('keeps a path, for a Flux served under one', () => {
    expect(socketAddressOf('https://example.com/flux')).toBe(
      'wss://example.com/flux/api/realtime',
    );
  });
});
