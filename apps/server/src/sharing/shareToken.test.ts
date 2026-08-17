import { describe, expect, it } from 'vitest';
import { hashShareToken, makeShareToken } from './shareToken';

describe('makeShareToken', () => {
  it('makes a token long enough that guessing one is not a strategy', () => {
    expect(makeShareToken().length).toBeGreaterThanOrEqual(40);
  });

  it('makes a different token every time', () => {
    const made = new Set(Array.from({ length: 200 }, () => makeShareToken()));

    expect(made.size).toBe(200);
  });

  it('makes a token a link can carry without escaping it', () => {
    for (let at = 0; at < 50; at += 1) {
      expect(makeShareToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('hashShareToken', () => {
  it('answers the same hash for the same token', () => {
    const token = makeShareToken();

    expect(hashShareToken(token)).toBe(hashShareToken(token));
  });

  it('answers a different hash for a different token', () => {
    expect(hashShareToken('one')).not.toBe(hashShareToken('two'));
  });

  it('never answers with the token itself', () => {
    const token = makeShareToken();

    expect(hashShareToken(token)).not.toContain(token);
  });
});
