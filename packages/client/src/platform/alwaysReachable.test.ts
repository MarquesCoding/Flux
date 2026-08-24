import { describe, expect, it } from 'vitest';
import { alwaysReachable } from './alwaysReachable';

describe('alwaysReachable', () => {
  it('says the server is there, which is the safe way to be wrong', () => {
    expect(alwaysReachable().isReachable()).toBe(true);
  });

  it('never changes its mind, and says so by never calling back', () => {
    let told = 0;

    alwaysReachable().whenChanged(() => {
      told += 1;
    });

    expect(told).toBe(0);
  });

  it('hands back a way to stop listening', () => {
    expect(() => alwaysReachable().whenChanged(() => {})()).not.toThrow();
  });
});
