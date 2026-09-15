import { describe, expect, it } from 'vitest';
import { readAssAlignment } from './readAssAlignment';

describe('reading where on the picture a line sits', () => {
  it('takes a keypad position as it is written', () => {
    expect(readAssAlignment('1', false)).toBe(1);
    expect(readAssAlignment('5', false)).toBe(5);
    expect(readAssAlignment('9', false)).toBe(9);
  });

  it('turns the older numbering into the keypad one', () => {
    expect(readAssAlignment('2', true)).toBe(2);
    expect(readAssAlignment('6', true)).toBe(8);
    expect(readAssAlignment('10', true)).toBe(5);
    expect(readAssAlignment('11', true)).toBe(6);
  });

  it('keeps the bottom row meaning the bottom in both numberings', () => {
    expect(readAssAlignment('1', true)).toBe(1);
    expect(readAssAlignment('3', true)).toBe(3);
  });

  it('refuses a number that names no position', () => {
    expect(readAssAlignment('0', false)).toBeNull();
    expect(readAssAlignment('10', false)).toBeNull();
    expect(readAssAlignment('4', true)).toBeNull();
    expect(readAssAlignment('nowhere', false)).toBeNull();
  });
});
