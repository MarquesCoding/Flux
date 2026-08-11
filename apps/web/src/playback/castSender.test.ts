import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCastSender, castStateOf, castStream, SENDER_URL, RECEIVER } from './castSender';
import type {
  CastCarrier,
  CastConnectionState,
  CastContext,
  CastLoadRequest,
  CastMediaInfo,
  CastSession,
  ScriptHost,
} from './castSender.types';

/**
 * The library as it presents itself once it has loaded: a global it installs,
 * and a callback it expects to find waiting.
 */
const installed = (
  state: CastConnectionState = 'NOT_CONNECTED',
  session: CastSession | null = null,
) => {
  const context: CastContext = {
    setOptions: vi.fn(),
    requestSession: vi.fn(() => Promise.resolve()),
    getCurrentSession: vi.fn(() => session),
    getCastState: vi.fn(() => state),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const carrier: CastCarrier = {
    cast: {
      framework: {
        CastContext: { getInstance: () => context },
        CastContextEventType: { CAST_STATE_CHANGED: 'caststatechanged' },
      },
    },
    chrome: {
      cast: {
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: 'CC1AD845',
          MediaInfo: class {
            metadata?: { title?: string };

            constructor(
              public contentId: string,
              public contentType: string,
            ) {}
          },
          LoadRequest: class {
            currentTime = 0;
            autoplay = false;

            constructor(public media: CastMediaInfo) {}
          },
          GenericMediaMetadata: class {
            title?: string;
          },
        },
        AutoJoinPolicy: { ORIGIN_SCOPED: 'origin_scoped' },
      },
    },
  };

  return { context, carrier };
};

/**
 * A document whose head answers, so the script can be seen to be added.
 */
const page = () => {
  const added: HTMLScriptElement[] = [];

  const host: ScriptHost = {
    createElement: () => document.createElement('script'),
    head: {
      append: (script: HTMLScriptElement) => {
        added.push(script);
      },
    },
  };

  return { added, host };
};

beforeEach(() => {
  // The loading is remembered on the page, which is what "once per page"
  // means — so each test gets its own page.
  vi.unstubAllGlobals();
});

describe('loadCastSender', () => {
  it('fetches the sender from where Google serves it', async () => {
    const { added, host } = page();
    const { carrier } = installed();
    const loading = loadCastSender(host, carrier);

    expect(added[0]?.src).toBe(SENDER_URL);

    carrier.__onGCastApiAvailable?.(true);
    await loading;
  });

  it('sets up the receiver that needs no registration', async () => {
    const { host } = page();
    const { carrier, context } = installed();
    const loading = loadCastSender(host, carrier);

    carrier.__onGCastApiAvailable?.(true);
    await loading;

    expect(context.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ receiverApplicationId: RECEIVER }),
    );
  });

  it('answers with nothing where the library said it is not available', async () => {
    const { host } = page();
    const { carrier } = installed();
    const loading = loadCastSender(host, carrier);

    carrier.__onGCastApiAvailable?.(false);

    await expect(loading).resolves.toBeNull();
  });

  it('answers with nothing where the request never arrived', async () => {
    const { added, host } = page();
    const { carrier } = installed();
    const loading = loadCastSender(host, carrier);

    added[0]?.dispatchEvent(new Event('error'));

    await expect(loading).resolves.toBeNull();
  });
});

describe('castStateOf', () => {
  it('says what the library says', () => {
    const { context } = installed('CONNECTED');

    expect(castStateOf(context)).toBe('CONNECTED');
  });

  it('says there is nothing where there is no library', () => {
    expect(castStateOf(null)).toBe('NO_DEVICES_AVAILABLE');
  });
});

describe('castStream', () => {
  it('sends an address and a position rather than any pixels', async () => {
    const loadMedia = vi.fn<(request: CastLoadRequest) => Promise<void>>(() => Promise.resolve());
    const session = { loadMedia, endSession: vi.fn(), getCastDevice: () => null };
    const { context, carrier } = installed('CONNECTED', session);

    vi.stubGlobal('chrome', carrier.chrome);

    await expect(
      castStream(context, {
        url: 'https://flux.local:5173/api/playback/session/abc/index.m3u8',
        title: 'Arrival',
        startSeconds: 812,
      }),
    ).resolves.toBe(true);

    const [request] = loadMedia.mock.calls[0] ?? [];

    expect(request?.currentTime).toBe(812);
    expect(request?.media.contentId).toBe(
      'https://flux.local:5173/api/playback/session/abc/index.m3u8',
    );
    expect(request?.media.metadata?.title).toBe('Arrival');

    vi.unstubAllGlobals();
  });

  it('says so when the receiver would not take it', async () => {
    const session = {
      loadMedia: vi.fn(() => Promise.reject(new Error('unsupported'))),
      endSession: vi.fn(),
      getCastDevice: () => null,
    };
    const { context, carrier } = installed('CONNECTED', session);

    vi.stubGlobal('chrome', carrier.chrome);

    await expect(
      castStream(context, {
        url: 'https://flux.local/a.m3u8',
        title: 'Arrival',
        startSeconds: 0,
      }),
    ).resolves.toBe(false);

    vi.unstubAllGlobals();
  });

  it('says so when nothing is connected to send to', async () => {
    const { context, carrier } = installed('NOT_CONNECTED', null);

    vi.stubGlobal('chrome', carrier.chrome);

    await expect(
      castStream(context, {
        url: 'https://flux.local/a.m3u8',
        title: 'Arrival',
        startSeconds: 0,
      }),
    ).resolves.toBe(false);

    vi.unstubAllGlobals();
  });
});
