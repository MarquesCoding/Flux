import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasFinePointer } from './hasFinePointer';

const answering = (matches: boolean) =>
  vi.fn(() => ({
    matches,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hasFinePointer', () => {
  it('agrees where the browser says there is one', () => {
    vi.stubGlobal('matchMedia', answering(true));

    expect(hasFinePointer()).toBe(true);
  });

  it('declines where the browser says there is not', () => {
    vi.stubGlobal('matchMedia', answering(false));

    expect(hasFinePointer()).toBe(false);
  });

  it('asks about hovering and pointing, not about width', () => {
    const asked = answering(true);

    vi.stubGlobal('matchMedia', asked);
    hasFinePointer();

    expect(asked).toHaveBeenCalledWith('(hover: hover) and (pointer: fine)');
  });

  it('declines where the browser cannot answer at all', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(hasFinePointer()).toBe(false);
  });
});
