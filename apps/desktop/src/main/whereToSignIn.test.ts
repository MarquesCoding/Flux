import { beforeEach, describe, expect, it } from 'vitest';
import { pointSignInAt, whereToSignIn } from './whereToSignIn';

beforeEach(() => {
  pointSignInAt('');
});

describe('whereToSignIn', () => {
  it('resolves nowhere before anybody has said where their Flux is', () => {
    expect(whereToSignIn().href).toBe('http://flux.invalid/');
  });

  it('is a URL even then, since the library throws on anything that is not one', () => {
    expect(() => new URL(whereToSignIn())).not.toThrow();
  });

  it('points at the server somebody named', () => {
    pointSignInAt('https://flux.example.com');

    expect(whereToSignIn().href).toBe('https://flux.example.com/');
  });

  it('is the same object throughout, which is what lets a copy made earlier still find it', () => {
    const taken = whereToSignIn();

    pointSignInAt('https://flux.example.com');

    expect(taken.href).toBe('https://flux.example.com/');
  });

  it('keeps a path, for a Flux served under one', () => {
    pointSignInAt('https://example.com/flux');

    expect(whereToSignIn().href).toBe('https://example.com/flux/');
  });

  it('does not double the slash on an address that ends in one', () => {
    pointSignInAt('https://flux.example.com/');

    expect(whereToSignIn().href).toBe('https://flux.example.com/');
  });

  it('goes back to nowhere for an address that is not one, rather than throwing later', () => {
    pointSignInAt('https://flux.example.com');
    pointSignInAt('not an address');

    expect(whereToSignIn().href).toBe('http://flux.invalid/');
  });
});
