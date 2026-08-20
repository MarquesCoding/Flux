import { describe, expect, it } from 'vitest';
import { distanceBetween, heldWithin, scaleFrom } from './pinch';

describe('distanceBetween', () => {
  it('measures how far apart two fingers are', () => {
    expect(distanceBetween({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 })).toBe(5);
  });

  it('measures nothing between a finger and itself', () => {
    expect(distanceBetween({ clientX: 7, clientY: 7 }, { clientX: 7, clientY: 7 })).toBe(0);
  });
});

describe('scaleFrom', () => {
  it('grows the page as the fingers part', () => {
    expect(scaleFrom(1, 100, 200)).toBe(2);
  });

  it('shrinks it back as they close', () => {
    expect(scaleFrom(2, 200, 100)).toBe(1);
  });

  it('carries on from where the last pinch left off', () => {
    expect(scaleFrom(2, 100, 150)).toBe(3);
  });

  it('never goes smaller than the page itself, which is what fitting is for', () => {
    expect(scaleFrom(1, 200, 50)).toBe(1);
  });

  it('stops before a page becomes a screenful of paper texture', () => {
    expect(scaleFrom(4, 100, 1000)).toBe(5);
  });

  it('does nothing where the fingers began on top of each other', () => {
    expect(scaleFrom(2, 0, 100)).toBe(2);
  });
});

describe('heldWithin', () => {
  it('lets a page be moved by as much as is hidden off the side', () => {
    expect(heldWithin(1000, 800, 3)).toBe(800);
  });

  it('lets it move the other way just as far', () => {
    expect(heldWithin(-1000, 800, 3)).toBe(-800);
  });

  it('leaves a page at its own size where it is, since none of it is hidden', () => {
    expect(heldWithin(300, 800, 1)).toBe(0);
  });

  it('leaves a small movement alone', () => {
    expect(heldWithin(50, 800, 3)).toBe(50);
  });
});
