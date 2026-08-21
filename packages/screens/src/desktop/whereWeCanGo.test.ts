import { describe, expect, it } from 'vitest';
import { whereWeCanGo } from './whereWeCanGo';

describe('whereWeCanGo', () => {
  it('puts a place ahead of us when we go back', () => {
    expect(whereWeCanGo(0, { type: 'BACK' })).toBe(1);
  });

  it('takes one away when we go forward again', () => {
    expect(whereWeCanGo(2, { type: 'FORWARD' })).toBe(1);
  });

  it('never counts below nothing', () => {
    expect(whereWeCanGo(0, { type: 'FORWARD' })).toBe(0);
  });

  it('throws away what was ahead when we go somewhere new', () => {
    expect(whereWeCanGo(3, { type: 'PUSH' })).toBe(0);
  });

  it('leaves the count alone when a place is replaced rather than added', () => {
    expect(whereWeCanGo(2, { type: 'REPLACE' })).toBe(2);
  });

  it('counts a jump of several places', () => {
    expect(whereWeCanGo(0, { type: 'GO', index: -2 })).toBe(2);
    expect(whereWeCanGo(3, { type: 'GO', index: 2 })).toBe(1);
  });
});
