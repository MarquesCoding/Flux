import { describe, expect, it, vi } from 'vitest';
import { attachShaka, deliveredFormat, faultFrom, CRITICAL } from './attachShaka';
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

    const attached = await attachShaka({
      element: element(),
      manifestUrl: '/sessions/abc/index.m3u8',
      loadShaka: () => Promise.resolve(module),
    });

    await attached.detach();

    expect(player.destroy).toHaveBeenCalled();
  });
});

describe('deliveredFormat', () => {
  it('reports the variant the engine actually selected', () => {
    const found = deliveredFormat([
      { active: false, videoCodec: 'hvc1', bandwidth: 40_000_000 },
      {
        active: true,
        videoCodec: 'avc1.640028',
        audioCodec: 'mp4a.40.2',
        mimeType: 'video/mp2t',
        width: 1920,
        height: 1040,
        frameRate: 23.976,
        bandwidth: 14_833_000,
        audioSamplingRate: 48_000,
        channelsCount: 2,
      },
    ]);

    expect(found?.videoCodec).toBe('avc1.640028');
    expect(found?.bitrateKbps).toBe(14_833);
    expect(found?.audioChannels).toBe(2);
  });

  it('says nothing where the engine has chosen no variant yet', () => {
    expect(deliveredFormat([])).toBeNull();
    expect(deliveredFormat([{ active: false, videoCodec: 'avc1' }])).toBeNull();
  });

  it('reports absent figures as absent rather than as zero', () => {
    const found = deliveredFormat([{ active: true }]);

    expect(found?.videoCodec).toBeNull();
    expect(found?.bitrateKbps).toBeNull();
    expect(found?.frameRate).toBeNull();
  });
});
