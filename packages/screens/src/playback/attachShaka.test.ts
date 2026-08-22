import { describe, expect, it, vi } from 'vitest';
import { attachShaka, deliveredFormat, faultFrom, CRITICAL } from './attachShaka';
import type { ShakaModule, ShakaPlayer, ShakaStats, ShakaVariant } from './attachShaka';

type Engine = {
  module: ShakaModule;
  player: ShakaPlayer;
  raise: (detail: object) => void;
};

const engine = (): Engine => {
  const listeners: ((event: Event) => void)[] = [];
  const configured = vi.fn();

  const player: ShakaPlayer = {
    attach: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    configure: configured,
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
        configure = configured;
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

const bufferedTo = (seconds: number | null): HTMLVideoElement => {
  const video = element();

  Object.defineProperty(video, 'buffered', {
    configurable: true,
    get: () => (seconds === null ? { length: 0, end: () => 0 } : { length: 1, end: () => seconds }),
  });

  return video;
};

const reporting = (
  readings: ShakaStats[],
  tracks: ShakaVariant[] = [],
): { module: ShakaModule; player: ShakaPlayer } => {
  const made = engine();
  let at = 0;

  const getStats = (): ShakaStats => readings[Math.min(at++, readings.length - 1)] ?? {};

  const getVariantTracks = (): ShakaVariant[] => tracks;

  const player: ShakaPlayer = { ...made.player, getStats, getVariantTracks };

  return {
    module: {
      polyfill: made.module.polyfill,
      Player: class {
        attach = player.attach;
        load = player.load;
        destroy = player.destroy;
        getStats = getStats;
        getVariantTracks = getVariantTracks;
        addEventListener = (name: string, listener: (event: Event) => void) => {
          made.player.addEventListener?.(name, listener);
        };
      },
    },
    player,
  };
};

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
    const found = deliveredFormat(
      [
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
      ],
      null,
    );

    expect(found?.videoCodec).toBe('avc1.640028');
    expect(found?.bitrateKbps).toBe(14_833);
    expect(found?.audioChannels).toBe(2);
  });

  it('says nothing where the engine has chosen no variant yet', () => {
    expect(deliveredFormat([], null)).toBeNull();
    expect(deliveredFormat([{ active: false, videoCodec: 'avc1' }], null)).toBeNull();
  });

  it('reports absent figures as absent rather than as zero', () => {
    const found = deliveredFormat([{ active: true }], null);

    expect(found?.videoCodec).toBeNull();
    expect(found?.bitrateKbps).toBeNull();
    expect(found?.frameRate).toBeNull();
  });
});

describe('deliveredFormat, a playlist that declares no bandwidth', () => {
  it('reports the measured rate rather than the nought Valence own playlists give', () => {
    const found = deliveredFormat([{ active: true, bandwidth: 0 }], { streamBandwidth: 0 }, 700);

    expect(found?.bitrateKbps).toBe(700);
  });

  it('prefers a declared figure where there is one to prefer', () => {
    const found = deliveredFormat([{ active: true, bandwidth: 4_500_000 }], null, 700);

    expect(found?.bitrateKbps).toBe(4500);
  });

  it('says nothing rather than nought before a window has been measured', () => {
    const found = deliveredFormat([{ active: true, bandwidth: 0 }], null, null);

    expect(found?.bitrateKbps).toBeNull();
  });
});

describe('attachShaka, reading what is actually being delivered', () => {
  it('resumes where it was left, rather than loading from the top', async () => {
    const made = engine();

    await attachShaka({
      element: element(),
      manifestUrl: '/stream.mpd',
      startSeconds: 120,
      loadShaka: () => Promise.resolve(made.module),
    });

    expect(made.player.load).toHaveBeenCalledWith('/stream.mpd', 120);
  });

  it('says nothing on the first reading, having nothing to measure against', async () => {
    const made = reporting([{ bytesDownloaded: 1_000_000 }]);

    const stream = await attachShaka({
      element: bufferedTo(10),
      manifestUrl: '/stream.mpd',
      loadShaka: () => Promise.resolve(made.module),
    });

    expect(stream.readDelivered()).toBeNull();
  });

  it('reports the rate it measured once two readings are apart', async () => {
    const made = reporting(
      [{ bytesDownloaded: 0 }, { bytesDownloaded: 5_000_000 }],
      [{ active: true, videoCodec: 'avc1.640028', bandwidth: 0 }],
    );
    const video = bufferedTo(0);
    let buffered = 0;

    Object.defineProperty(video, 'buffered', {
      configurable: true,
      get: () => ({ length: 1, end: () => buffered }),
    });

    const stream = await attachShaka({
      element: video,
      manifestUrl: '/stream.mpd',
      loadShaka: () => Promise.resolve(made.module),
    });

    stream.readDelivered();

    buffered = 10;

    expect(stream.readDelivered()).toEqual(
      expect.objectContaining({ bitrateKbps: (5_000_000 * 8) / 10 / 1000 }),
    );
  });

  it('starts again rather than reporting a negative rate when the counters go backwards', async () => {
    const made = reporting([{ bytesDownloaded: 9_000_000 }, { bytesDownloaded: 1_000_000 }]);

    const stream = await attachShaka({
      element: bufferedTo(10),
      manifestUrl: '/stream.mpd',
      loadShaka: () => Promise.resolve(made.module),
    });

    stream.readDelivered();

    expect(stream.readDelivered()).toBeNull();
  });

  it('treats an element that will not say what it holds as holding nothing', async () => {
    const made = reporting([{ bytesDownloaded: 1 }]);
    const video = element();

    Object.defineProperty(video, 'buffered', {
      configurable: true,
      get: () => {
        throw new Error('The element is not ready');
      },
    });

    const stream = await attachShaka({
      element: video,
      manifestUrl: '/stream.mpd',
      loadShaka: () => Promise.resolve(made.module),
    });

    expect(stream.readDelivered()).toBeNull();
  });
});

describe('the timestamps Shaka plays to', () => {
  it('takes them from the order segments arrive in, which is what stops it dropping frames', async () => {
    const { module, player } = engine();

    await attachShaka({
      element: element(),
      manifestUrl: '/manifest.m3u8',
      loadShaka: () => Promise.resolve(module),
    });

    expect(player.configure).toHaveBeenCalledWith({ manifest: { hls: { sequenceMode: true } } });
  });

  it('settles that before it loads anything, since it cannot be changed underneath a stream', async () => {
    const order: string[] = [];
    const module: ShakaModule = {
      polyfill: { installAll: vi.fn() },
      Player: class {
        attach = () => Promise.resolve();
        destroy = () => Promise.resolve();
        configure = () => {
          order.push('configure');
        };
        load = () => {
          order.push('load');

          return Promise.resolve();
        };
      },
    };

    await attachShaka({
      element: element(),
      manifestUrl: '/manifest.m3u8',
      loadShaka: () => Promise.resolve(module),
    });

    expect(order).toEqual(['configure', 'load']);
  });
});
