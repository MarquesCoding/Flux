import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CROSSFADE_MILLISECONDS, revealTheme } from './revealTheme';

/**
 * Says whether the machine has been asked for less movement.
 */
const machineAsksForStillness = (isAsking: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isAsking && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
};

const isEasing = (): boolean => document.documentElement.hasAttribute('data-theme-shift');

beforeEach(() => {
  vi.useFakeTimers();
  machineAsksForStillness(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset['themeShift'];
  delete document.documentElement.dataset['motion'];
});

describe('revealTheme', () => {
  it('changes the theme', () => {
    const apply = vi.fn();

    revealTheme(apply);

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('marks the page while the colours ease, and takes the mark off after', () => {
    revealTheme(vi.fn());

    expect(isEasing()).toBe(true);

    vi.advanceTimersByTime(CROSSFADE_MILLISECONDS);

    expect(isEasing()).toBe(false);
  });

  it('never photographs the page, so whatever is playing keeps playing', () => {
    const photograph = vi.fn();

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: photograph,
    });

    revealTheme(vi.fn());

    expect(photograph).not.toHaveBeenCalled();

    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('changes it outright for somebody whose machine asks for less movement', () => {
    machineAsksForStillness(true);

    const apply = vi.fn();

    revealTheme(apply);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(isEasing()).toBe(false);
  });

  it('changes it outright where less movement was chosen here', () => {
    document.documentElement.dataset['motion'] = 'reduced';

    revealTheme(vi.fn());

    expect(isEasing()).toBe(false);
  });

  it('eases it anyway where movement was chosen here, whatever the machine asks for', () => {
    machineAsksForStillness(true);
    document.documentElement.dataset['motion'] = 'full';

    revealTheme(vi.fn());

    expect(isEasing()).toBe(true);
  });
});
