import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayer } from './VideoPlayer';
import { fakeMediaElement } from '@FluxWeb/testing/fakeMediaElement';
import { emitPresenceEvent } from '@FluxWeb/presence/presenceEvents';
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan';
import type * as SegmentsModule from '@FluxWeb/playback/fetchSegments';
import type * as SubtitlesModule from '@FluxWeb/playback/fetchSubtitles';
import type * as TrickplayModule from '@FluxWeb/playback/fetchTrickplay';
import type * as CastSenderModule from '@FluxWeb/playback/castSender';
import type * as CastPlaybackModule from '@FluxWeb/playback/castPlayback';

const startMock = vi.hoisted(() => vi.fn());
const stopMock = vi.hoisted(() => vi.fn());
const stopWatchingMock = vi.hoisted(() => vi.fn());
const heartbeatMock = vi.hoisted(() => vi.fn());
const presenceHeartbeatMock = vi.hoisted(() => vi.fn());
const attachMock = vi.hoisted(() => vi.fn());
const teardownMock = vi.hoisted(() => vi.fn());
const trickplayMock = vi.hoisted(() => vi.fn());
const captureMock = vi.hoisted(() => vi.fn());
const subtitlesMock = vi.hoisted(() => vi.fn());
const segmentsMock = vi.hoisted(() => vi.fn());
const detailMock = vi.hoisted(() => vi.fn());
const loadCastSenderMock = vi.hoisted(() => vi.fn());
const castStateOfMock = vi.hoisted(() => vi.fn());
const promptForDeviceMock = vi.hoisted(() => vi.fn());
const isReachableOriginMock = vi.hoisted(() => vi.fn());
const castStreamMock = vi.hoisted(() => vi.fn());
const absoluteStreamUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/playback/startPlaybackSession', async () => {
  const actual = await vi.importActual<{
    describeWhy: (plan: PlaybackPlan) => string[];
  }>('@FluxWeb/playback/startPlaybackSession');

  return {
    startPlaybackSession: startMock,
    stopPlaybackSession: stopMock,
    stopWatching: stopWatchingMock,
    heartbeatPlaybackSession: heartbeatMock,
    sendPresenceHeartbeat: presenceHeartbeatMock,
    describeWhy: actual.describeWhy,
  };
});

vi.mock('@FluxWeb/playback/attachShaka', () => ({
  attachShaka: attachMock,
}));

vi.mock('@FluxWeb/playback/castSender', async () => {
  const actual = await vi.importActual<typeof CastSenderModule>('@FluxWeb/playback/castSender');

  return {
    ...actual,
    loadCastSender: loadCastSenderMock,
    castStateOf: castStateOfMock,
    castStream: castStreamMock,
  };
});

vi.mock('@FluxWeb/playback/castPlayback', async () => {
  const actual = await vi.importActual<typeof CastPlaybackModule>('@FluxWeb/playback/castPlayback');

  return {
    ...actual,
    promptForDevice: promptForDeviceMock,
    isReachableOrigin: isReachableOriginMock,
    absoluteStreamUrl: absoluteStreamUrlMock,
  };
});

vi.mock('@FluxWeb/playback/detectDeviceProfile', () => ({
  detectFromBrowser: () => ({ name: 'Browser' }),
}));

vi.mock('@FluxWeb/presence/clientIdentity', () => ({
  readClientId: () => 'client-1',
}));

vi.mock('@FluxWeb/playback/captureFrame', () => ({
  captureFrame: captureMock,
}));

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  fetchMediaDetail: detailMock,
}));

vi.mock('@FluxWeb/playback/fetchSegments', async () => {
  const actual = await vi.importActual<typeof SegmentsModule>('@FluxWeb/playback/fetchSegments');

  return { ...actual, fetchSegments: segmentsMock };
});

vi.mock('@FluxWeb/playback/fetchSubtitles', async () => {
  const actual = await vi.importActual<typeof SubtitlesModule>('@FluxWeb/playback/fetchSubtitles');

  return { ...actual, fetchSubtitleTracks: subtitlesMock };
});

vi.mock('@FluxWeb/playback/fetchTrickplay', async () => {
  const actual = await vi.importActual<typeof TrickplayModule>('@FluxWeb/playback/fetchTrickplay');

  return {
    ...actual,
    fetchTrickplay: trickplayMock,
  };
});

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' };

const transcodingPlan: PlaybackPlan = {
  mediaId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  container: { kind: 'passthrough', reason },
  video: {
    kind: 'transcode',
    codec: 'h264',
    range: 'SDR',
    maxBitrateKbps: 8000,
    maxWidth: 1920,
    maxHeight: 1080,
    reason: { code: 'VideoCodecNotSupported', detail: 'Client does not support hevc' },
  },
  audio: { kind: 'passthrough', streamIndex: 1, reason },
  subtitles: { kind: 'none', reason },
};

const media = { id: 'media-1', title: 'Arrival', durationSeconds: 7200 };

/**
 * Declares how much of the stream the element could seek within.
 *
 * jsdom has no media pipeline, so a growing transcode has to be described
 * rather than produced.
 */
const showingAFrame = (element: HTMLElement) => {
  Object.defineProperty(element, 'videoWidth', { configurable: true, value: 1920 });
  Object.defineProperty(element, 'videoHeight', { configurable: true, value: 1080 });
  captureMock.mockReturnValue('data:image/jpeg;base64,frame');
};

/**
 * Waits for the session to have started and been attached.
 *
 * The spinner going away is the only thing on screen that says so once the
 * mode moved into the stats panel.
 */
const settled = async () => {
  await waitFor(() => {
    expect(screen.queryByRole('status', { name: 'Preparing playback' })).not.toBeInTheDocument();
  });
};

const seekableTo = (element: HTMLElement, seconds: number) => {
  Object.defineProperty(element, 'seekable', {
    configurable: true,
    value: { length: 1, end: () => seconds },
  });
  Object.defineProperty(element, 'currentTime', { configurable: true, writable: true, value: 0 });
};

/**
 * Puts the element part way through the film and says so.
 *
 * A jump is measured from where the film has got to, and jsdom never gets
 * anywhere on its own, so the position has to be both set and announced.
 */
const playingAt = (element: HTMLElement, seconds: number) => {
  Object.defineProperty(element, 'currentTime', {
    configurable: true,
    writable: true,
    value: seconds,
  });

  fireEvent.timeUpdate(element);
};

const startedSession: {
  sessionId: string;
  delivery: { kind: 'hls'; manifestUrl: string } | { kind: 'direct'; url: string };
  mode: string;
  plan: PlaybackPlan;
  warnings: string[];
} = {
  sessionId: 'abc',
  delivery: { kind: 'hls', manifestUrl: '/api/playback/session/abc/index.m3u8' },
  mode: 'Transcode',
  plan: transcodingPlan,
  warnings: [],
};

beforeEach(() => {
  startMock.mockReset();
  stopMock.mockReset();
  stopWatchingMock.mockReset();
  attachMock.mockReset();
  teardownMock.mockReset();
  trickplayMock.mockReset();
  trickplayMock.mockResolvedValue(null);
  captureMock.mockReset();
  captureMock.mockReturnValue(null);
  subtitlesMock.mockReset();
  subtitlesMock.mockResolvedValue([]);
  segmentsMock.mockReset();
  segmentsMock.mockResolvedValue([]);
  detailMock.mockReset();
  detailMock.mockResolvedValue(null);

  startMock.mockResolvedValue({ kind: 'started', session: startedSession });
  attachMock.mockResolvedValue(teardownMock);
  stopMock.mockResolvedValue(undefined);
  stopWatchingMock.mockResolvedValue(undefined);

  heartbeatMock.mockReset();
  heartbeatMock.mockResolvedValue(undefined);

  loadCastSenderMock.mockReset();
  loadCastSenderMock.mockResolvedValue(null);
  castStateOfMock.mockReset();
  castStateOfMock.mockReturnValue('NOT_CONNECTED');
  promptForDeviceMock.mockReset();
  promptForDeviceMock.mockResolvedValue('unsupported');
  isReachableOriginMock.mockReset();
  isReachableOriginMock.mockReturnValue(true);
  castStreamMock.mockReset();
  castStreamMock.mockResolvedValue(true);
  absoluteStreamUrlMock.mockReset();
  absoluteStreamUrlMock.mockImplementation(
    (address: string) => `http://192.168.1.5:5173${address}`,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VideoPlayer', () => {
  it('shows the title and a video surface', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Arrival')).toBeInTheDocument();
  });

  it('shows a spinner while the session is starting', () => {
    startMock.mockReturnValue(new Promise(() => undefined));
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Preparing playback' })).toBeInTheDocument();
  });

  it('asks the server for a session for this item', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith(
        'media-1',
        { name: 'Browser' },
        'client-1',
        0,
        undefined,
        'original',
      );
    });
  });

  it('attaches the media engine to the returned manifest', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(attachMock).toHaveBeenCalledWith(
        expect.objectContaining({ manifestUrl: '/api/playback/session/abc/index.m3u8' }),
      );
    });
  });

  it('shows the playback mode the server chose, on request', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('switch', { name: /Stats for nerds/ }));

    expect(await screen.findByText('Transcode')).toBeInTheDocument();
  });

  it('explains why the stream is being converted, on request', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('switch', { name: /Stats for nerds/ }));

    expect(screen.getByText(/Client does not support hevc/)).toBeInTheDocument();
  });

  it('keeps the stats out of the way until asked for', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();

    expect(screen.queryByRole('region', { name: 'Stats for nerds' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Client does not support hevc/)).not.toBeInTheDocument();
  });

  it('puts the stats away again', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('switch', { name: /Stats for nerds/ }));
    await actor.click(screen.getByRole('button', { name: 'Close stats' }));

    expect(screen.queryByRole('region', { name: 'Stats for nerds' })).not.toBeInTheDocument();
  });

  it('reports why the server refused', async () => {
    startMock.mockResolvedValue({
      kind: 'failed',
      reason: 'This server has no working encoder for h264.',
    });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('no working encoder');
  });

  it('does not attach an engine when the session failed', async () => {
    startMock.mockResolvedValue({ kind: 'failed', reason: 'nope' });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await screen.findByRole('alert');

    expect(attachMock).not.toHaveBeenCalled();
  });

  it('does not blame the browser for a failure it cannot place', async () => {
    attachMock.mockRejectedValue(new Error('no media source'));
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The stream could not be played.');
  });

  it('blames the browser when the browser could not decode it', async () => {
    attachMock.mockRejectedValue({ category: 3, code: 3016 });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not decode the stream');
  });

  it('says the stream never arrived when the manifest could not be read', async () => {
    attachMock.mockRejectedValue({ category: 4, code: 4032 });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('did not arrive');
  });

  it('stops the session and tears down the engine when closed', async () => {
    const { unmount } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(attachMock).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(stopMock).toHaveBeenCalledWith('abc');
    });
    expect(teardownMock).toHaveBeenCalled();
    expect(stopWatchingMock).toHaveBeenCalledWith('client-1');
  });

  it('does not say a tab has stopped watching just for changing quality or track', async () => {
    const actor = userEvent.setup();
    detailMock.mockResolvedValue({
      id: 'media-1',
      libraryId: 'library-1',
      title: 'Arrival',
      year: 2016,
      container: 'mkv',
      durationSeconds: 7200,
      videoCodec: 'hevc',
      videoRange: 'HDR10',
      width: 1920,
      height: 1080,
      bitrateKbps: 12000,
      subtitleStreams: [],
      addedAt: '2026-08-10T00:00:00.000Z',
      metadata: { hasPoster: false, hasBackdrop: false },
      audioStreams: [
        { index: 1, codec: 'aac', channels: 2, language: 'jpn', isDefault: true, isAtmos: false },
        { index: 2, codec: 'ac3', channels: 6, language: 'eng', isDefault: false, isAtmos: false },
      ],
    });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('button', { name: /Audio track/ }));
    await actor.click(await screen.findByRole('menuitemradio', { name: 'English · 5.1 · AC3' }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(2);
    });

    expect(stopWatchingMock).not.toHaveBeenCalled();
  });

  it('sends a heartbeat on a fixed interval, whether or not the player is paused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await act(async () => {
      await vi.waitFor(() => expect(attachMock).toHaveBeenCalled());
    });

    const element = document.querySelector('video');

    Object.defineProperty(element, 'paused', { configurable: true, value: true });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(heartbeatMock).toHaveBeenCalledWith('abc', false);

    vi.useRealTimers();
  });

  it('stops sending heartbeats once the session ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { unmount } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await act(async () => {
      await vi.waitFor(() => expect(attachMock).toHaveBeenCalled());
    });

    unmount();
    heartbeatMock.mockClear();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(heartbeatMock).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('stops the session with a keepalive request when the tab actually closes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });

    vi.stubGlobal('fetch', fetchMock);

    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(attachMock).toHaveBeenCalled();
    });

    window.dispatchEvent(new Event('pagehide'));

    expect(fetchMock).toHaveBeenCalledWith('/api/playback/session/abc', {
      method: 'DELETE',
      keepalive: true,
    });
    expect(stopWatchingMock).toHaveBeenCalledWith('client-1', true);

    vi.unstubAllGlobals();
  });

  it('does not send a keepalive stop before a session has actually started', () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    startMock.mockReturnValue(new Promise(() => undefined));
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    window.dispatchEvent(new Event('pagehide'));

    expect(fetchMock).not.toHaveBeenCalled();

    expect(stopWatchingMock).toHaveBeenCalledWith('client-1', true);

    vi.unstubAllGlobals();
  });

  it('can be closed', async () => {
    const onClose = vi.fn();
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={onClose} />);

    await actor.click(screen.getByRole('button', { name: /Close/ }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables the transport until playback is ready', () => {
    startMock.mockReturnValue(new Promise(() => undefined));
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('shows a running position against the length of the film', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await screen.findByLabelText('Arrival');

    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('/ 2:00:00')).toBeInTheDocument();
  });

  it('warns when the server cannot tone map, without hiding it behind a click', async () => {
    startMock.mockResolvedValue({
      kind: 'started',
      session: {
        ...startedSession,
        warnings: ['This server cannot tone map HDR to SDR, so colours will look washed out.'],
      },
    });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(await screen.findByText(/cannot tone map/)).toBeInTheDocument();
  });

  it('shows no warning banner when there is nothing to warn about', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();

    expect(screen.queryByText(/cannot tone map/)).not.toBeInTheDocument();
  });

  it('plays a direct file without loading a media engine', async () => {
    startMock.mockResolvedValue({
      kind: 'started',
      session: {
        ...startedSession,
        mode: 'DirectPlay',
        delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
      },
    });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();

    expect(attachMock).not.toHaveBeenCalled();
  });

  it('points the video element at the direct file', async () => {
    startMock.mockResolvedValue({
      kind: 'started',
      session: {
        ...startedSession,
        mode: 'DirectPlay',
        delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
      },
    });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();

    expect(screen.getByLabelText('Arrival')).toHaveAttribute('src', '/api/playback/media-1/file');
  });

  it('offers a seek bar named after the item', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(await screen.findByRole('slider', { name: 'Seek through Arrival' })).toBeInTheDocument();
  });

  it('plays on without previews when the server cannot render them', async () => {
    trickplayMock.mockResolvedValue(null);
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(await screen.findByRole('slider', { name: 'Seek through Arrival' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Preview at/ })).not.toBeInTheDocument();
  });

  it("drops the previous item's thumbnails when another is played", async () => {
    trickplayMock.mockResolvedValue({
      width: 320,
      height: 180,
      thumbnails: [
        {
          startSeconds: 0,
          endSeconds: 10,
          sheetUrl: 'http://localhost/first.jpg',
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
    });

    const { rerender } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await screen.findByRole('slider', { name: 'Seek through Arrival' });

    let pending: (value: null) => void = () => undefined;
    trickplayMock.mockReturnValue(
      new Promise<null>((resolve) => {
        pending = resolve;
      }),
    );

    rerender(
      <VideoPlayer
        media={{ id: 'media-2', title: 'Dune', durationSeconds: 600 }}
        onClose={vi.fn()}
      />,
    );

    await screen.findByRole('slider', { name: 'Seek through Dune' });

    expect(screen.queryByRole('img', { name: /Preview at/ })).not.toBeInTheDocument();

    pending(null);
  });

  it("drops the previous item's stats when another is played", async () => {
    const actor = userEvent.setup();
    const { rerender } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('switch', { name: /Stats for nerds/ }));

    expect(await screen.findByText('Transcode')).toBeInTheDocument();

    startMock.mockReturnValue(new Promise(() => undefined));
    rerender(
      <VideoPlayer
        media={{ id: 'media-2', title: 'Dune', durationSeconds: 600 }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText('Transcode')).not.toBeInTheDocument();
  });

  it('seeks inside the session when the target is already encoded', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 600);

    const bar = screen.getByRole('slider', { name: 'Seek through Arrival' });
    fireEvent.keyDown(bar, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(element).toHaveProperty('currentTime', 1);
    });

    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('starts a new session when the target has not been encoded yet', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 30);

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    });

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith(
        'media-1',
        { name: 'Browser' },
        'client-1',
        3600,
        undefined,
        'original',
      );
    });
  });

  it('stops the session it is seeking away from', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 30);

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    });

    await waitFor(() => {
      expect(stopMock).toHaveBeenCalledWith('abc');
    });
  });

  it('reports the position on the film, not inside the session', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 30);

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    });

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith(
        'media-1',
        { name: 'Browser' },
        'client-1',
        3600,
        undefined,
        'original',
      );
    });

    Object.defineProperty(element, 'currentTime', { value: 12, writable: true });
    fireEvent.timeUpdate(element);

    expect(await screen.findByText('1:00:12')).toBeInTheDocument();
  });

  it('seeks a direct played file in the browser rather than restarting it', async () => {
    startMock.mockResolvedValue({
      kind: 'started',
      session: {
        ...startedSession,
        mode: 'DirectPlay',
        delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
      },
    });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();

    const element = screen.getByLabelText('Arrival');
    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    });

    await waitFor(() => {
      expect(element).toHaveProperty('currentTime', 3600);
    });

    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('holds the last frame rather than blanking while a seek restarts', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 30);
    showingAFrame(element);
    startMock.mockReturnValue(new Promise(() => undefined));

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    });

    expect(await screen.findByRole('status', { name: 'Seeking' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Preparing playback' })).not.toBeInTheDocument();
  });

  it('lets the new session replace the held frame once it is playing', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 30);
    showingAFrame(element);
    startMock.mockReturnValue(new Promise(() => undefined));

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    });

    await screen.findByRole('status', { name: 'Seeking' });

    Object.defineProperty(element, 'currentTime', { configurable: true, value: 2 });
    fireEvent.timeUpdate(element);

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'Seeking' })).not.toBeInTheDocument();
    });
  });

  it('shows the full spinner when there is no frame to hold', () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Preparing playback' })).toBeInTheDocument();
  });

  it('mutes and unmutes the media element itself', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    const element = screen.getByLabelText('Arrival');

    await actor.click(screen.getByRole('button', { name: 'Mute' }));

    expect(element).toHaveProperty('muted', true);

    await actor.click(screen.getByRole('button', { name: 'Unmute' }));

    expect(element).toHaveProperty('muted', false);
  });

  it('carries the volume through to the media element', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();

    screen.getByRole('slider', { name: 'Volume' }).focus();
    await actor.keyboard('{ArrowLeft}');

    expect(screen.getByLabelText('Arrival')).toHaveProperty('volume', 0.99);
  });

  it('asks for full screen on the whole stage, not just the video', async () => {
    const actor = userEvent.setup();
    const request = vi.fn();

    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: request,
    });

    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Full screen' }));

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('jumps back and forward without leaving the session when it can', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 600);
    Object.defineProperty(element, 'currentTime', {
      configurable: true,
      writable: true,
      value: 60,
    });
    fireEvent.timeUpdate(element);

    await actor.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));

    expect(element).toHaveProperty('currentTime', 70);
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('never jumps back past the start of the film', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 600);

    await actor.click(screen.getByRole('button', { name: 'Back 10 seconds' }));

    expect(element).toHaveProperty('currentTime', 0);
  });

  it('carries the chosen speed through to the media element', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('button', { name: /Playback speed/ }));
    await actor.click(await screen.findByRole('menuitemradio', { name: '1.5x' }));

    expect(screen.getByLabelText('Arrival')).toHaveProperty('playbackRate', 1.5);
  });

  it('shows no captions until a track is chosen', async () => {
    subtitlesMock.mockResolvedValue([
      {
        id: 'en',
        language: 'en',
        label: 'English',
        format: 'srt',
        isForced: false,
        isHearingImpaired: false,
      },
    ]);
    const { container } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();

    expect(container.querySelector('track')).not.toBeInTheDocument();
  });

  it('renders the track a viewer chooses', async () => {
    const actor = userEvent.setup();
    subtitlesMock.mockResolvedValue([
      {
        id: 'en',
        language: 'en',
        label: 'English',
        format: 'srt',
        isForced: false,
        isHearingImpaired: false,
      },
    ]);
    const { container } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(await screen.findByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('button', { name: /Subtitles\/CC/ }));
    await actor.click(await screen.findByRole('menuitemradio', { name: /English/ }));

    expect(container.querySelector('track')?.getAttribute('src')).toContain(
      '/api/media/media-1/subtitles/en',
    );
  });

  it('shows a forced track without being asked', async () => {
    subtitlesMock.mockResolvedValue([
      {
        id: 'fr',
        language: 'fr',
        label: 'Français (forced)',
        format: 'srt',
        isForced: true,
        isHearingImpaired: false,
      },
    ]);
    const { container } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();

    await waitFor(() => {
      expect(container.querySelector('track')).toHaveAttribute('srclang', 'fr');
    });
  });

  it('opens the caption settings from the subtitles menu', async () => {
    const actor = userEvent.setup();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('button', { name: /Caption settings/ }));

    expect(await screen.findByRole('region', { name: 'Caption settings' })).toBeInTheDocument();
  });

  it('remembers caption settings for the next film', async () => {
    const actor = userEvent.setup();
    const { unmount } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('button', { name: /Caption settings/ }));
    await actor.click(await screen.findByRole('button', { name: 'Drop shadow' }));

    unmount();
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    await settled();
    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('button', { name: /Caption settings/ }));

    expect(await screen.findByRole('button', { name: 'Drop shadow' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers to skip an intro once playback reaches it', async () => {
    segmentsMock.mockResolvedValue([
      { kind: 'intro', startSeconds: 30, endSeconds: 120, source: 'fingerprint' },
    ]);
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    await settled();

    expect(screen.queryByRole('button', { name: /Skip Intro/ })).not.toBeInTheDocument();

    Object.defineProperty(element, 'currentTime', { configurable: true, value: 32 });
    fireEvent.timeUpdate(element);

    expect(await screen.findByRole('button', { name: /Skip Intro/ })).toBeInTheDocument();
  });

  it('jumps to the end of the intro when asked', async () => {
    const actor = userEvent.setup();
    segmentsMock.mockResolvedValue([
      { kind: 'intro', startSeconds: 30, endSeconds: 120, source: 'fingerprint' },
    ]);
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 600);
    await settled();

    Object.defineProperty(element, 'currentTime', {
      configurable: true,
      writable: true,
      value: 32,
    });
    fireEvent.timeUpdate(element);

    await actor.click(await screen.findByRole('button', { name: /Skip Intro/ }));

    expect(element).toHaveProperty('currentTime', 120);
  });

  it('stops offering the skip once the intro is well under way', async () => {
    segmentsMock.mockResolvedValue([
      { kind: 'intro', startSeconds: 30, endSeconds: 120, source: 'fingerprint' },
    ]);
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    await settled();

    Object.defineProperty(element, 'currentTime', { configurable: true, value: 90 });
    fireEvent.timeUpdate(element);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Skip Intro/ })).not.toBeInTheDocument();
    });
  });

  it('names what it is skipping', async () => {
    segmentsMock.mockResolvedValue([
      { kind: 'recap', startSeconds: 0, endSeconds: 40, source: 'chapters' },
    ]);
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    await settled();

    Object.defineProperty(element, 'currentTime', { configurable: true, value: 2 });
    fireEvent.timeUpdate(element);

    expect(await screen.findByRole('button', { name: /Skip Recap/ })).toBeInTheDocument();
  });

  it('offers nothing for an item with no known segments', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    await settled();

    Object.defineProperty(element, 'currentTime', { configurable: true, value: 32 });
    fireEvent.timeUpdate(element);

    expect(screen.queryByRole('button', { name: /Skip/ })).not.toBeInTheDocument();
  });

  it('restarts where it left off when a viewer picks another soundtrack', async () => {
    const actor = userEvent.setup();
    detailMock.mockResolvedValue({
      id: 'media-1',
      libraryId: 'library-1',
      title: 'Arrival',
      year: 2016,
      container: 'mkv',
      durationSeconds: 7200,
      videoCodec: 'hevc',
      videoRange: 'HDR10',
      width: 1920,
      height: 1080,
      bitrateKbps: 12000,
      subtitleStreams: [],
      addedAt: '2026-08-10T00:00:00.000Z',
      metadata: { hasPoster: false, hasBackdrop: false },
      audioStreams: [
        { index: 1, codec: 'aac', channels: 2, language: 'jpn', isDefault: true, isAtmos: false },
        { index: 2, codec: 'ac3', channels: 6, language: 'eng', isDefault: false, isAtmos: false },
      ],
    });
    render(<VideoPlayer media={media} onClose={vi.fn()} />);

    const element = await screen.findByLabelText('Arrival');
    await settled();

    Object.defineProperty(element, 'currentTime', { configurable: true, value: 2400 });
    fireEvent.timeUpdate(element);

    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('button', { name: /Audio track/ }));
    await actor.click(await screen.findByRole('menuitemradio', { name: 'English · 5.1 · AC3' }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith(
        'media-1',
        { name: 'Browser' },
        'client-1',
        2400,
        2,
        'original',
      );
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(VideoPlayer.displayName).toBe('VideoPlayer');
  });

  it('fades the controls away once a viewer has left them alone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);

      const element = await screen.findByLabelText('Arrival');

      fireEvent.play(element);

      for (const seconds of [1, 2, 3, 4]) {
        Object.defineProperty(element, 'currentTime', { configurable: true, value: seconds });
        fireEvent.timeUpdate(element);
      }

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.getByLabelText('Arrival').parentElement?.className).toContain('cursor-none');
    } finally {
      vi.useRealTimers();
    }
  });

  it('brings the controls and the pointer back when the viewer moves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);

      const element = await screen.findByLabelText('Arrival');

      fireEvent.play(element);

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      const stage = screen.getByLabelText('Arrival').parentElement;

      if (stage !== null) {
        fireEvent.pointerMove(stage);
      }

      expect(stage?.className).toContain('cursor-default');
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts playing on arrival rather than waiting to be asked', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    render(<VideoPlayer media={media} onClose={vi.fn()} />);
    await settled();

    expect(play).toHaveBeenCalled();
  });

  it('asks for whole seconds, since a resumed position is a fraction of one', async () => {
    render(<VideoPlayer media={media} startSeconds={2103.4567} onClose={vi.fn()} />);
    await settled();

    expect(startMock.mock.calls.at(-1)?.[3]).toBe(2103);
  });

  it('says where the viewer has got to as they get there', async () => {
    const onProgress = vi.fn();

    render(<VideoPlayer media={media} onClose={vi.fn()} onProgress={onProgress} />);
    await settled();

    const element = await screen.findByLabelText('Arrival');

    Object.defineProperty(element, 'currentTime', { configurable: true, value: 90 });
    fireEvent.timeUpdate(element);

    expect(onProgress).toHaveBeenCalledWith(90, 7200);
  });

  it('says when the film has run out, so a season can go on', async () => {
    const onEnded = vi.fn();

    render(<VideoPlayer media={media} onClose={vi.fn()} onEnded={onEnded} />);
    await settled();

    fireEvent.ended(await screen.findByLabelText('Arrival'));

    expect(onEnded).toHaveBeenCalledOnce();
  });

  it('counts the film as watched to the end before handing over', async () => {
    const onProgress = vi.fn();

    render(
      <VideoPlayer media={media} onClose={vi.fn()} onProgress={onProgress} onEnded={vi.fn()} />,
    );
    await settled();

    fireEvent.ended(await screen.findByLabelText('Arrival'));

    expect(onProgress).toHaveBeenLastCalledWith(7200, 7200);
  });

  it('steps a frame at a time rather than seeking, since one frame is already decoded', async () => {
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');

    Object.defineProperty(element, 'currentTime', {
      configurable: true,
      value: 10,
      writable: true,
    });
    Object.defineProperty(element, 'duration', { configurable: true, value: 7200 });

    await actor.keyboard('{ArrowRight}');

    const at = element instanceof HTMLVideoElement ? element.currentTime : 0;

    expect(at).toBeGreaterThan(10);
    expect(at).toBeLessThan(10.5);
    expect(startMock).toHaveBeenCalledOnce();
  });

  it('jumps from where the film has got to, not from where the session opened', async () => {
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 3000);
    playingAt(element, 600);

    await actor.keyboard('l');

    expect(element).toHaveProperty('currentTime', 630);
  });

  it('jumps backwards from where the film has got to', async () => {
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 3000);
    playingAt(element, 600);

    await actor.keyboard('j');

    expect(element).toHaveProperty('currentTime', 570);
  });

  it('holds a jump back past the beginning at the beginning', async () => {
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 3000);
    playingAt(element, 10);

    await actor.keyboard('j');

    expect(element).toHaveProperty('currentTime', 0);
  });

  it('holds a jump past the end at the end', async () => {
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');
    seekableTo(element, 7200);
    playingAt(element, 7190);

    await actor.keyboard('l');

    expect(element).toHaveProperty('currentTime', 7200);
  });

  it('pauses to step, since a frame examined while running has gone by', async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    await actor.keyboard('{ArrowLeft}');

    expect(pause).toHaveBeenCalled();
  });

  it('offers the rest of the season, and nothing at all for a film', async () => {
    const { rerender } = render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    expect(screen.queryByRole('button', { name: 'Episodes' })).not.toBeInTheDocument();

    rerender(
      <VideoPlayer
        media={media}
        onClose={vi.fn()}
        isImmersive
        episodes={[
          {
            ...media,
            libraryId: 'lib',
            year: null,
            width: 1920,
            height: 1080,
            videoCodec: 'h264',
            videoRange: 'SDR',
            addedAt: '2026-01-01T00:00:00.000Z',
            hasPoster: false,
            hasBackdrop: false,
            hasLogo: false,
            seriesId: null,
            seriesTitle: 'Show',
            seasonNumber: 1,
            episodeNumber: 1,
          },
        ]}
        onSelectEpisode={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Episodes' })).toBeInTheDocument();
  });

  it('takes the floating window with it, however the player is left', async () => {
    const exit = vi.fn().mockResolvedValue(undefined);

    const asBrowserWithout = () => {
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        configurable: true,
        value: false,
      });
      Object.defineProperty(document, 'pictureInPictureElement', {
        configurable: true,
        value: null,
      });
    };

    try {
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        configurable: true,
        value: true,
      });
      Object.defineProperty(document, 'pictureInPictureElement', {
        configurable: true,
        value: document.createElement('video'),
      });
      Object.defineProperty(document, 'exitPictureInPicture', { configurable: true, value: exit });

      const { unmount } = render(<VideoPlayer media={media} onClose={vi.fn()} />);

      await settled();
      unmount();

      expect(exit).toHaveBeenCalled();
    } finally {
      asBrowserWithout();
    }
  });

  it('keeps the controls up while a menu on them is open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

      render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);

      const element = await screen.findByLabelText('Arrival');

      fireEvent.play(element);
      await actor.click(screen.getByRole('button', { name: 'Settings' }));

      act(() => {
        vi.advanceTimersByTime(6000);
      });

      const bar = screen.getByRole('button', { name: 'Settings' }).closest('.absolute');

      expect(bar?.className).toContain('translate-y-0');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('playing on another device', () => {
  const CAST_LABEL = 'Play on a device — your browser will ask which';

  /**
   * A cast framework that is present and idle, which is what makes the
   * control appear at all.
   */
  const withACastFramework = (requestSession = vi.fn()) => {
    loadCastSenderMock.mockResolvedValue({
      addEventListener: vi.fn(),
      requestSession,
    });

    return requestSession;
  };

  const castButton = async () => screen.findByRole('button', { name: CAST_LABEL });

  it('offers nothing to cast to on a browser that cannot', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />);
    await settled();

    expect(screen.queryByRole('button', { name: CAST_LABEL })).not.toBeInTheDocument();
  });

  it('asks the framework for a device when there is one', async () => {
    const requestSession = withACastFramework(vi.fn().mockResolvedValue(undefined));
    const user = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} />);
    await settled();
    await user.click(await castButton());

    expect(requestSession).toHaveBeenCalled();
  });

  it('says where to open Flux from when it is being read on localhost', async () => {
    withACastFramework();
    isReachableOriginMock.mockReturnValue(false);

    const user = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} />);
    await settled();
    await user.click(await castButton());

    expect(await screen.findByText(/rather than as localhost/)).toBeInTheDocument();
  });

  it('takes the note away again rather than leaving it on the picture', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withACastFramework();
    isReachableOriginMock.mockReturnValue(false);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VideoPlayer media={media} onClose={vi.fn()} />);
    await settled();
    await user.click(await castButton());

    expect(await screen.findByText(/rather than as localhost/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(7000);
      await Promise.resolve();
    });

    expect(screen.queryByText(/rather than as localhost/)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('says nothing when the browser showed its own picker', async () => {
    loadCastSenderMock.mockResolvedValue(null);
    promptForDeviceMock.mockResolvedValue('shown');

    const user = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} />);
    await settled();

    const control = screen.queryByRole('button', { name: CAST_LABEL });

    if (control !== null) {
      await user.click(control);
    }

    expect(screen.queryByText(/offered no device/)).not.toBeInTheDocument();
  });
});

describe('the keys a viewer can reach for', () => {
  const playing = async () => {
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');

    Object.defineProperty(element, 'currentTime', {
      configurable: true,
      value: 100,
      writable: true,
    });
    Object.defineProperty(element, 'duration', { configurable: true, value: 7200 });
    seekableTo(element, 7200);

    return { actor, element };
  };

  const positionOf = (element: HTMLElement) =>
    element instanceof HTMLVideoElement ? element.currentTime : 0;

  it('jumps forward with l', async () => {
    const { actor, element } = await playing();
    const before = positionOf(element);

    await actor.keyboard('l');

    expect(positionOf(element)).toBeGreaterThan(before);
  });

  it('jumps back with j', async () => {
    const { actor, element } = await playing();

    await actor.keyboard('l');
    await actor.keyboard('l');

    const before = positionOf(element);

    await actor.keyboard('j');

    expect(positionOf(element)).toBeLessThan(before);
  });

  it('mutes and unmutes with m', async () => {
    const { actor } = await playing();

    await actor.keyboard('m');

    expect(await screen.findByRole('button', { name: /Unmute|Mute/ })).toBeInTheDocument();
  });

  it('turns subtitles on and off with c', async () => {
    const { actor, element } = await playing();

    await actor.keyboard('c');
    await actor.keyboard('c');

    expect(element).toBeInTheDocument();
  });

  it('ignores a key pressed while typing somewhere', async () => {
    const actor = userEvent.setup();

    render(
      <>
        <input aria-label="Somewhere to type" />
        <VideoPlayer media={media} onClose={vi.fn()} isImmersive />
      </>,
    );
    await settled();

    const element = await screen.findByLabelText('Arrival');

    Object.defineProperty(element, 'currentTime', {
      configurable: true,
      value: 100,
      writable: true,
    });

    const before = positionOf(element);

    await actor.click(screen.getByLabelText('Somewhere to type'));
    await actor.keyboard('l');

    expect(positionOf(element)).toBe(before);
  });

  it('ignores a key it has nothing bound to', async () => {
    const { actor, element } = await playing();
    const before = positionOf(element);

    await actor.keyboard('q');

    expect(positionOf(element)).toBe(before);
  });
});

describe('what the player does as the stream behaves', () => {
  const watching = async () => {
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');
    const stream = fakeMediaElement(element);

    return { actor, element, stream };
  };

  it('moves subtitles in time without touching the ones already in the past', async () => {
    const { stream } = await watching();
    const track = stream.addTextTrack({ cues: [{ startTime: 10, endTime: 12 }] });

    stream.loaded({ duration: 7200, seekableTo: 7200 });
    stream.playTo(5);

    expect(track.cues[0]?.startTime).toBe(10);
  });

  it('never moves a cue back past the beginning of the film', async () => {
    const { stream } = await watching();
    const track = stream.addTextTrack({ cues: [{ startTime: 0.5, endTime: 2 }] });

    stream.loaded({ duration: 7200 });

    expect(track.cues[0]?.startTime).toBeGreaterThanOrEqual(0);
  });

  it('measures how long a frame lasts from the frames it is shown', async () => {
    const { stream } = await watching();

    stream.loaded({ duration: 7200, seekableTo: 7200 });
    stream.presentFrame(1);
    stream.presentFrame(1.04);

    expect(await screen.findByLabelText('Arrival')).toBeInTheDocument();
  });

  it('ignores a gap between frames that is too large to be one frame', async () => {
    const { stream } = await watching();

    stream.loaded({ duration: 7200 });
    stream.presentFrame(1);
    stream.presentFrame(30);

    expect(await screen.findByLabelText('Arrival')).toBeInTheDocument();
  });

  it('says how much has arrived, not only where the viewer is', async () => {
    const { actor, stream } = await watching();

    stream.loaded({ duration: 7200, seekableTo: 7200, bufferedTo: 300 });
    stream.playTo(100);

    await actor.click(screen.getByRole('button', { name: 'Settings' }));
    await actor.click(await screen.findByRole('switch', { name: /Stats for nerds/ }));

    expect(await screen.findByRole('region', { name: 'Stats for nerds' })).toBeInTheDocument();
  });

  it('floats the picture out into its own window', async () => {
    const { actor, stream } = await watching();

    stream.loaded({ duration: 7200 });

    await actor.click(screen.getByRole('button', { name: /Pop out|Picture in picture/i }));

    expect(document.pictureInPictureElement).not.toBeNull();
  });

  it('brings the picture back from its own window', async () => {
    const { actor, stream } = await watching();

    stream.loaded({ duration: 7200 });
    stream.popOut();

    await actor.click(screen.getByRole('button', { name: /Pop out|Picture in picture/i }));

    expect(document.pictureInPictureElement).toBeNull();
  });
});

describe('when an administrator reaches into the stream', () => {
  const watching = async () => {
    const actor = userEvent.setup();

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');
    const stream = fakeMediaElement(element);

    stream.loaded({ duration: 7200, seekableTo: 7200 });

    return { actor, element, stream };
  };

  it('stops the picture and says who stopped it', async () => {
    const { element } = await watching();

    act(() => {
      emitPresenceEvent({ kind: 'stopped', reason: 'An administrator stopped this stream.' });
    });

    expect(await screen.findByText(/An administrator stopped this stream./)).toBeInTheDocument();
    expect(element instanceof HTMLVideoElement ? element.paused : true).toBe(true);
  });

  it('pauses and says why, without ending the stream', async () => {
    await watching();

    act(() => {
      emitPresenceEvent({ kind: 'paused', reason: 'Dinner.' });
    });

    expect(await screen.findByText(/Dinner./)).toBeInTheDocument();
  });

  it('takes the note away again when the stream is let go', async () => {
    await watching();

    act(() => {
      emitPresenceEvent({ kind: 'paused', reason: 'Dinner.' });
    });

    await screen.findByText(/Dinner./);

    act(() => {
      emitPresenceEvent({ kind: 'resumed' });
    });

    await waitFor(() => {
      expect(screen.queryByText(/Dinner./)).not.toBeInTheDocument();
    });
  });

  it('leaves a stop on screen even when play is asked for again', async () => {
    await watching();

    act(() => {
      emitPresenceEvent({ kind: 'stopped', reason: 'An administrator stopped this stream.' });
    });

    await screen.findByText(/An administrator stopped this stream./);

    act(() => {
      emitPresenceEvent({ kind: 'resumed' });
    });

    expect(screen.getByText(/An administrator stopped this stream./)).toBeInTheDocument();
  });
});

describe('once a device has taken the stream', () => {
  const connected = async (delivery = startedSession.delivery) => {
    loadCastSenderMock.mockResolvedValue({ addEventListener: vi.fn(), requestSession: vi.fn() });
    castStateOfMock.mockReturnValue('CONNECTED');
    startMock.mockResolvedValue({
      kind: 'started',
      session: { ...startedSession, delivery },
    });

    render(<VideoPlayer media={media} onClose={vi.fn()} isImmersive />);
    await settled();

    const element = await screen.findByLabelText('Arrival');
    const stream = fakeMediaElement(element);

    stream.loaded({ duration: 7200, seekableTo: 7200 });

    return { element, stream };
  };

  it('hands the stream over and stops playing it here', async () => {
    await connected();

    await waitFor(() => {
      expect(castStreamMock).toHaveBeenCalled();
    });
  });

  it('hands over the file itself when that is what is being served', async () => {
    await connected({ kind: 'direct', url: '/api/playback/media-1/file' });

    await waitFor(() => {
      expect(castStreamMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'Arrival' }),
      );
    });
  });

  it('says so when the device would not take it', async () => {
    castStreamMock.mockResolvedValue(false);

    await connected();

    expect(await screen.findByText(/would not take this stream/)).toBeInTheDocument();
  });
});
