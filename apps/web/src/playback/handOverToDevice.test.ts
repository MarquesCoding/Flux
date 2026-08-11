import { describe, expect, it, vi } from 'vitest';
import { handOverToDevice } from './handOverToDevice';

const REACHABLE = 'http://flux.local:5173';

/**
 * A video element that can be handed to a device, as Chrome presents one.
 */
const castable = (isRefused = false) => {
  const closed = new Error('closed');

  closed.name = 'AbortError';

  const element = document.createElement('video');

  Object.defineProperty(element, 'remote', {
    configurable: true,
    value: {
      state: 'disconnected',
      prompt: vi.fn(() => (isRefused ? Promise.reject(closed) : Promise.resolve())),
      watchAvailability: vi.fn(() => Promise.resolve(1)),
      cancelWatchAvailability: vi.fn(() => Promise.resolve()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });

  return element;
};

describe('handOverToDevice', () => {
  it('points the element at an address a device can fetch', async () => {
    const element = castable();

    await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: REACHABLE,
    });

    expect(element.src).toBe('http://flux.local:5173/api/playback/session/abc/index.m3u8');
  });

  it('lets go of the media engine', async () => {
    const element = castable();
    const release = vi.fn(() => Promise.resolve());

    await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: REACHABLE,
      release,
    });

    expect(release).toHaveBeenCalled();
  });

  it('carries on from where the viewer was', async () => {
    const element = castable();

    Object.defineProperty(element, 'currentTime', {
      configurable: true,
      writable: true,
      value: 812,
    });

    await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: REACHABLE,
    });

    expect(element.currentTime).toBe(812);
  });

  it('refuses where the page is at an address nothing else can follow', async () => {
    const element = castable();
    const release = vi.fn(() => Promise.resolve());

    const shown = await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: 'http://localhost:5173',
      release,
    });

    expect(shown).toBe(false);
    expect(release).not.toHaveBeenCalled();
  });

  it('lets go of the engine before pointing the element anywhere', async () => {
    const element = castable();
    const order: string[] = [];

    Object.defineProperty(element, 'src', {
      configurable: true,
      set: () => order.push('pointed'),
      get: () => '',
    });

    await handOverToDevice({
      element,
      url: '/api/playback/session/abc/index.m3u8',
      origin: REACHABLE,
      release: () => {
        order.push('released');

        return Promise.resolve();
      },
    });

    expect(order).toEqual(['released', 'pointed']);
  });
});
