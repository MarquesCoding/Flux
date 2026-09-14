import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revealTheme } from './revealTheme';

const animateMock =
  vi.fn<(keyframes: PropertyIndexedKeyframes, options: KeyframeAnimationOptions) => void>();

/**
 * A browser that can photograph a page, whose change is over only when the test says so.
 */
const aBrowserThatPhotographs = () => {
  let finish: () => void = () => undefined;

  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });

  const start = vi.fn((update: () => void) => {
    update();

    return {
      ready: Promise.resolve(),
      finished,
      updateCallbackDone: Promise.resolve(),
      skipTransition: vi.fn(),
    };
  });

  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    writable: true,
    value: start,
  });

  return {
    start,
    finish: () => {
      finish();
    },
  };
};

/**
 * Says whether somebody has asked their system for less movement.
 */
const askingForLessMovement = (isAsking: boolean) => {
  const real = window.matchMedia('(prefers-reduced-motion: reduce)');

  vi.spyOn(window, 'matchMedia').mockReturnValue({ ...real, matches: isAsking });
};

beforeEach(() => {
  askingForLessMovement(false);

  Object.defineProperty(document.documentElement, 'animate', {
    configurable: true,
    writable: true,
    value: animateMock,
  });
});

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition');
  Reflect.deleteProperty(document.documentElement, 'animate');
  delete document.documentElement.dataset['themeShift'];
  animateMock.mockReset();
  vi.restoreAllMocks();
});

describe('revealTheme', () => {
  it('simply changes the theme where the browser cannot photograph a page', () => {
    const apply = vi.fn();

    revealTheme(apply, { x: 10, y: 10 });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(document.documentElement.hasAttribute('data-theme-shift')).toBe(false);
  });

  it('simply changes it for somebody who has asked for less movement', () => {
    const browser = aBrowserThatPhotographs();
    const apply = vi.fn();

    askingForLessMovement(true);
    revealTheme(apply, { x: 10, y: 10 });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(browser.start).not.toHaveBeenCalled();
  });

  it('simply changes it while something is playing, rather than holding a still over it', () => {
    const browser = aBrowserThatPhotographs();
    const apply = vi.fn();

    const playing = document.createElement('video');

    Object.defineProperty(playing, 'paused', { configurable: true, value: false });
    document.body.append(playing);

    revealTheme(apply, { x: 10, y: 10 });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(browser.start).not.toHaveBeenCalled();

    playing.remove();
  });

  it('still opens out where a video is on the page but paused', async () => {
    const browser = aBrowserThatPhotographs();

    const paused = document.createElement('video');

    document.body.append(paused);

    revealTheme(vi.fn(), { x: 10, y: 10 });

    expect(browser.start).toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    paused.remove();
  });

  it('photographs the page as it was, and changes the theme underneath it', () => {
    const browser = aBrowserThatPhotographs();
    const apply = vi.fn();

    revealTheme(apply, { x: 10, y: 10 });

    expect(browser.start).toHaveBeenCalledWith(apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('opens the new theme out from where somebody pressed', async () => {
    aBrowserThatPhotographs();

    revealTheme(vi.fn(), { x: 100, y: 50 });

    await vi.waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const [keyframes, options] = animateMock.mock.calls[0] ?? [];

    expect(keyframes).toEqual({
      clipPath: [expect.stringContaining('circle(0px at 100px 50px)'), expect.any(String)],
    });
    expect(options).toEqual(
      expect.objectContaining({ pseudoElement: '::view-transition-new(root)' }),
    );
  });

  it('opens it far enough to cover the furthest corner', async () => {
    aBrowserThatPhotographs();

    revealTheme(vi.fn(), { x: 0, y: 0 });

    await vi.waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const reach = Math.hypot(window.innerWidth, window.innerHeight);
    const [keyframes] = animateMock.mock.calls[0] ?? [];

    expect(keyframes).toEqual({
      clipPath: [expect.any(String), `circle(${reach.toString()}px at 0px 0px)`],
    });
  });

  it('opens it from the middle where nobody pressed anywhere', async () => {
    aBrowserThatPhotographs();

    revealTheme(vi.fn(), null);

    await vi.waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const middle = `${(window.innerWidth / 2).toString()}px ${(window.innerHeight / 2).toString()}px`;
    const [keyframes] = animateMock.mock.calls[0] ?? [];

    expect(keyframes).toEqual({
      clipPath: [`circle(0px at ${middle})`, expect.any(String)],
    });
  });

  it('marks the page while it changes, and takes the mark off once it has', async () => {
    const browser = aBrowserThatPhotographs();

    revealTheme(vi.fn(), { x: 10, y: 10 });

    expect(document.documentElement.hasAttribute('data-theme-shift')).toBe(true);

    browser.finish();

    await vi.waitFor(() => {
      expect(document.documentElement.hasAttribute('data-theme-shift')).toBe(false);
    });
  });
});
