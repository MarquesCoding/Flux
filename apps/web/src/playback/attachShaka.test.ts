import { describe, expect, it, vi } from 'vitest';
import { attachShaka, faultFrom, CRITICAL } from './attachShaka';
import type { ShakaModule, ShakaPlayer } from './attachShaka';

type Engine = {
  module: ShakaModule;
  player: ShakaPlayer;
  raise: (detail: object) => void;
};

const engine = (): Engine => {
  const listeners: ((event: Event) => void)[] = [];

  const player: ShakaPlayer = {
    attach: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    addEventListener: (_name, listener) => {
      listeners.push(listener);
    },
  };

  return {
    module: {
      polyfill: { installAll: vi.fn() },
      Player: class {
        attach = player.attach;
        load = player.load;
        destroy = player.destroy;
        addEventListener = (name: string, listener: (event: Event) => void) => {
          player.addEventListener?.(name, listener);
        };
      },
    },
    player,
    raise: (detail) => {
      const event = new Event('error');

      Object.defineProperty(event, 'detail', { value: detail });

      for (const listener of listeners) {
        listener(event);
      }
    },
  };
};

const element = (): HTMLVideoElement => document.createElement('video');

describe('faultFrom', () => {
  it('reads what the engine reported', () => {
    const event = new Event('error');

    Object.defineProperty(event, 'detail', {
      value: { severity: 2, category: 3, code: 3016 },
    });

    expect(faultFrom(event)).toEqual({ severity: 2, category: 3, code: 3016 });
  });

  it('has nothing to report for an event carrying no error', () => {
    expect(faultFrom(new Event('error'))).toBeNull();
  });
});

describe('attachShaka', () => {
  it('reports a failure the engine raises after loading rather than by rejecting', async () => {
    const { module, raise } = engine();
    const onFault = vi.fn();

    await attachShaka({
      element: element(),
      manifestUrl: '/sessions/abc/index.m3u8',
      onFault,
      loadShaka: () => Promise.resolve(module),
    });

    raise({ severity: CRITICAL, category: 3, code: 3016 });

    expect(onFault).toHaveBeenCalledWith({ severity: CRITICAL, category: 3, code: 3016 });
  });

  it('says nothing about an event that carries no failure', async () => {
    const { module, raise } = engine();
    const onFault = vi.fn();

    await attachShaka({
      element: element(),
      manifestUrl: '/sessions/abc/index.m3u8',
      onFault,
      loadShaka: () => Promise.resolve(module),
    });

    raise({ nothing: true });

    expect(onFault).not.toHaveBeenCalled();
  });

  it('hands back a teardown that destroys the engine', async () => {
    const { module, player } = engine();

    const teardown = await attachShaka({
      element: element(),
      manifestUrl: '/sessions/abc/index.m3u8',
      loadShaka: () => Promise.resolve(module),
    });

    await teardown();

    expect(player.destroy).toHaveBeenCalled();
  });
});
