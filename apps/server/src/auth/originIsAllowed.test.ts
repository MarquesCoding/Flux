import { describe, expect, it } from 'vitest';
import { originIsAllowed } from './originIsAllowed';

const CONFIGURED = ['https://flux.example.com', 'https://localhost:5173'];

describe('originIsAllowed', () => {
  it('lets a client at an origin this deployment names read the answer', () => {
    expect(originIsAllowed('https://flux.example.com', CONFIGURED)).toBe(
      'https://flux.example.com',
    );
  });

  it('refuses one nobody named', () => {
    expect(originIsAllowed('https://somewhere.else', CONFIGURED)).toBeNull();
  });

  it('always allows the desktop client, which is not a website anybody can navigate to', () => {
    expect(originIsAllowed('app.flux.desktop:/', [])).toBe('app.flux.desktop:/');
  });

  it('says nothing where the request named no origin, which is a same-origin request', () => {
    expect(originIsAllowed(undefined, CONFIGURED)).toBeNull();
    expect(originIsAllowed('', CONFIGURED)).toBeNull();
  });

  it('does not care whether the configured origin was written with a trailing slash', () => {
    expect(originIsAllowed('https://flux.example.com', ['https://flux.example.com/'])).toBe(
      'https://flux.example.com',
    );
  });

  it('refuses a different port, which is a different origin however local it looks', () => {
    expect(originIsAllowed('https://localhost:9999', CONFIGURED)).toBeNull();
  });

  it('refuses a different scheme on a named host', () => {
    expect(originIsAllowed('http://flux.example.com', CONFIGURED)).toBeNull();
  });

  it('refuses something that merely starts the same, rather than matching a prefix', () => {
    expect(originIsAllowed('https://flux.example.com.evil.test', CONFIGURED)).toBeNull();
  });
});
