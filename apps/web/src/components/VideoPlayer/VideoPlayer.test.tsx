import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VideoPlayerModule from './VideoPlayer'
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan'
import type TrickplayModule from '@FluxWeb/playback/fetchTrickplay'

const { VideoPlayer } = VideoPlayerModule

const startMock = vi.hoisted(() => vi.fn())
const stopMock = vi.hoisted(() => vi.fn())
const attachMock = vi.hoisted(() => vi.fn())
const teardownMock = vi.hoisted(() => vi.fn())
const trickplayMock = vi.hoisted(() => vi.fn())
const captureMock = vi.hoisted(() => vi.fn())

vi.mock('@FluxWeb/playback/startPlaybackSession', async () => {
  const actual = await vi.importActual<{
    default: { describeWhy: (plan: PlaybackPlan) => string[] }
  }>('@FluxWeb/playback/startPlaybackSession')

  return {
    default: {
      startPlaybackSession: startMock,
      stopPlaybackSession: stopMock,
      describeWhy: actual.default.describeWhy,
    },
  }
})

vi.mock('@FluxWeb/playback/attachShaka', () => ({
  default: { attachShaka: attachMock },
}))

vi.mock('@FluxWeb/playback/detectDeviceProfile', () => ({
  default: { detectFromBrowser: () => ({ name: 'Browser' }) },
}))

// jsdom has no 2d context, so a real capture can only ever answer with
// nothing here. What it does with a frame is covered where the capture lives.
vi.mock('@FluxWeb/playback/captureFrame', () => ({
  default: { captureFrame: captureMock },
}))

vi.mock('@FluxWeb/playback/fetchTrickplay', async () => {
  const actual = await vi.importActual<{ default: typeof TrickplayModule }>(
    '@FluxWeb/playback/fetchTrickplay',
  )

  return {
    default: { ...actual.default, fetchTrickplay: trickplayMock },
  }
})

const reason: Reason = { code: 'ClientSupportsSource', detail: 'Client declares support' }

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
  audio: { kind: 'passthrough', reason },
  subtitles: { kind: 'none', reason },
}

const media = { id: 'media-1', title: 'Arrival', durationSeconds: 7200 }

/**
 * Declares how much of the stream the element could seek within.
 *
 * jsdom has no media pipeline, so a growing transcode has to be described
 * rather than produced.
 */
const showingAFrame = (element: HTMLElement) => {
  Object.defineProperty(element, 'videoWidth', { configurable: true, value: 1920 })
  Object.defineProperty(element, 'videoHeight', { configurable: true, value: 1080 })
  captureMock.mockReturnValue('data:image/jpeg;base64,frame')
}

/**
 * Waits for the session to have started and been attached.
 *
 * The spinner going away is the only thing on screen that says so once the
 * mode moved into the stats panel.
 */
const settled = async () => {
  await waitFor(() => {
    expect(screen.queryByRole('status', { name: 'Preparing playback' })).not.toBeInTheDocument()
  })
}

const seekableTo = (element: HTMLElement, seconds: number) => {
  Object.defineProperty(element, 'seekable', {
    configurable: true,
    value: { length: 1, end: () => seconds },
  })
  Object.defineProperty(element, 'currentTime', { configurable: true, writable: true, value: 0 })
}

const startedSession: {
  sessionId: string
  delivery: { kind: 'hls'; manifestUrl: string } | { kind: 'direct'; url: string }
  mode: string
  plan: PlaybackPlan
  warnings: string[]
} = {
  sessionId: 'abc',
  delivery: { kind: 'hls', manifestUrl: '/api/playback/session/abc/index.m3u8' },
  mode: 'Transcode',
  plan: transcodingPlan,
  warnings: [],
}

beforeEach(() => {
  startMock.mockReset()
  stopMock.mockReset()
  attachMock.mockReset()
  teardownMock.mockReset()
  trickplayMock.mockReset()
  trickplayMock.mockResolvedValue(null)
  captureMock.mockReset()
  captureMock.mockReturnValue(null)

  startMock.mockResolvedValue({ kind: 'started', session: startedSession })
  attachMock.mockResolvedValue(teardownMock)
  stopMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('VideoPlayer', () => {
  it('shows the title and a video surface', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Arrival')).toBeInTheDocument()
  })

  it('shows a spinner while the session is starting', () => {
    startMock.mockReturnValue(new Promise(() => undefined))
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'Preparing playback' })).toBeInTheDocument()
  })

  it('asks the server for a session for this item', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith('media-1', { name: 'Browser' }, 0)
    })
  })

  it('attaches the media engine to the returned manifest', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(attachMock).toHaveBeenCalledWith(
        expect.objectContaining({ manifestUrl: '/api/playback/session/abc/index.m3u8' }),
      )
    })
  })

  it('shows the playback mode the server chose, on request', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()
    await actor.click(screen.getByRole('button', { name: 'Stats for nerds' }))

    expect(await screen.findByText('Transcode')).toBeInTheDocument()
  })

  it('explains why the stream is being converted, on request', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()
    await actor.click(screen.getByRole('button', { name: 'Stats for nerds' }))

    expect(screen.getByText(/Client does not support hevc/)).toBeInTheDocument()
  })

  it('keeps the stats out of the way until asked for', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()

    expect(screen.queryByRole('region', { name: 'Stats for nerds' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Client does not support hevc/)).not.toBeInTheDocument()
  })

  it('puts the stats away again', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()
    await actor.click(screen.getByRole('button', { name: 'Stats for nerds' }))
    await actor.click(screen.getByRole('button', { name: 'Close stats' }))

    expect(screen.queryByRole('region', { name: 'Stats for nerds' })).not.toBeInTheDocument()
  })

  it('reports why the server refused', async () => {
    startMock.mockResolvedValue({
      kind: 'failed',
      reason: 'This server has no working encoder for h264.',
    })
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('no working encoder')
  })

  it('does not attach an engine when the session failed', async () => {
    startMock.mockResolvedValue({ kind: 'failed', reason: 'nope' })
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await screen.findByRole('alert')

    expect(attachMock).not.toHaveBeenCalled()
  })

  it('reports a browser that cannot play the stream', async () => {
    attachMock.mockRejectedValue(new Error('no media source'))
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('could not play the stream')
  })

  it('stops the session and tears down the engine when closed', async () => {
    const { unmount } = render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(attachMock).toHaveBeenCalled()
    })

    unmount()

    await waitFor(() => {
      expect(stopMock).toHaveBeenCalledWith('abc')
    })
    expect(teardownMock).toHaveBeenCalled()
  })

  it('can be closed', async () => {
    const onClose = vi.fn()
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={onClose} />)

    await actor.click(screen.getByRole('button', { name: /Close/ }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disables the transport until playback is ready', () => {
    startMock.mockReturnValue(new Promise(() => undefined))
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  })

  it('shows a running position against the length of the film', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await screen.findByLabelText('Arrival')

    expect(screen.getByText('0:00')).toBeInTheDocument()
    expect(screen.getByText('/ 2:00:00')).toBeInTheDocument()
  })

  it('warns when the server cannot tone map, without hiding it behind a click', async () => {
    startMock.mockResolvedValue({
      kind: 'started',
      session: {
        ...startedSession,
        warnings: ['This server cannot tone map HDR to SDR, so colours will look washed out.'],
      },
    })
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(await screen.findByText(/cannot tone map/)).toBeInTheDocument()
  })

  it('shows no warning banner when there is nothing to warn about', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()

    expect(screen.queryByText(/cannot tone map/)).not.toBeInTheDocument()
  })

  it('plays a direct file without loading a media engine', async () => {
    startMock.mockResolvedValue({
      kind: 'started',
      session: {
        ...startedSession,
        mode: 'DirectPlay',
        delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
      },
    })
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()

    expect(attachMock).not.toHaveBeenCalled()
  })

  it('points the video element at the direct file', async () => {
    startMock.mockResolvedValue({
      kind: 'started',
      session: {
        ...startedSession,
        mode: 'DirectPlay',
        delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
      },
    })
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()

    expect(screen.getByLabelText('Arrival')).toHaveAttribute('src', '/api/playback/media-1/file')
  })

  it('offers a seek bar named after the item', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(await screen.findByRole('slider', { name: 'Seek through Arrival' })).toBeInTheDocument()
  })

  it('plays on without previews when the server cannot render them', async () => {
    trickplayMock.mockResolvedValue(null)
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(await screen.findByRole('slider', { name: 'Seek through Arrival' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Preview at/ })).not.toBeInTheDocument()
  })

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
    })

    const { rerender } = render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await screen.findByRole('slider', { name: 'Seek through Arrival' })

    let pending: (value: null) => void = () => undefined
    trickplayMock.mockReturnValue(
      new Promise<null>((resolve) => {
        pending = resolve
      }),
    )

    rerender(
      <VideoPlayer
        media={{ id: 'media-2', title: 'Dune', durationSeconds: 600 }}
        onClose={vi.fn()}
      />,
    )

    await screen.findByRole('slider', { name: 'Seek through Dune' })

    expect(screen.queryByRole('img', { name: /Preview at/ })).not.toBeInTheDocument()

    pending(null)
  })

  it("drops the previous item's stats when another is played", async () => {
    const actor = userEvent.setup()
    const { rerender } = render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()
    await actor.click(screen.getByRole('button', { name: 'Stats for nerds' }))

    expect(await screen.findByText('Transcode')).toBeInTheDocument()

    startMock.mockReturnValue(new Promise(() => undefined))
    rerender(
      <VideoPlayer
        media={{ id: 'media-2', title: 'Dune', durationSeconds: 600 }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText('Transcode')).not.toBeInTheDocument()
  })

  it('seeks inside the session when the target is already encoded', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    const element = await screen.findByLabelText('Arrival')
    seekableTo(element, 600)

    const bar = screen.getByRole('slider', { name: 'Seek through Arrival' })
    fireEvent.keyDown(bar, { key: 'ArrowRight' })

    await waitFor(() => {
      expect(element).toHaveProperty('currentTime', 1)
    })

    expect(startMock).toHaveBeenCalledTimes(1)
  })

  it('starts a new session when the target has not been encoded yet', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    const element = await screen.findByLabelText('Arrival')
    seekableTo(element, 30)

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    })

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith('media-1', { name: 'Browser' }, 3600)
    })
  })

  it('stops the session it is seeking away from', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    const element = await screen.findByLabelText('Arrival')
    seekableTo(element, 30)

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    })

    await waitFor(() => {
      expect(stopMock).toHaveBeenCalledWith('abc')
    })
  })

  it('reports the position on the film, not inside the session', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    const element = await screen.findByLabelText('Arrival')
    seekableTo(element, 30)

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    })

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith('media-1', { name: 'Browser' }, 3600)
    })

    Object.defineProperty(element, 'currentTime', { value: 12, writable: true })
    fireEvent.timeUpdate(element)

    expect(await screen.findByText('1:00:12')).toBeInTheDocument()
  })

  it('seeks a direct played file in the browser rather than restarting it', async () => {
    startMock.mockResolvedValue({
      kind: 'started',
      session: {
        ...startedSession,
        mode: 'DirectPlay',
        delivery: { kind: 'direct', url: '/api/playback/media-1/file' },
      },
    })
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()

    const element = screen.getByLabelText('Arrival')
    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    })

    await waitFor(() => {
      expect(element).toHaveProperty('currentTime', 3600)
    })

    expect(startMock).toHaveBeenCalledTimes(1)
  })

  it('holds the last frame rather than blanking while a seek restarts', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    const element = await screen.findByLabelText('Arrival')
    seekableTo(element, 30)
    showingAFrame(element)
    startMock.mockReturnValue(new Promise(() => undefined))

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    })

    // The centred spinner is what covers the video. While a frame is held, the
    // wait has to be reported without hiding what it is waiting on.
    expect(await screen.findByRole('status', { name: 'Seeking' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Preparing playback' })).not.toBeInTheDocument()
  })

  it('lets the new session replace the held frame once it is playing', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    const element = await screen.findByLabelText('Arrival')
    seekableTo(element, 30)
    showingAFrame(element)
    startMock.mockReturnValue(new Promise(() => undefined))

    fireEvent.change(screen.getByRole('slider', { name: 'Seek through Arrival' }), {
      target: { value: '3600' },
    })

    await screen.findByRole('status', { name: 'Seeking' })

    Object.defineProperty(element, 'currentTime', { configurable: true, value: 2 })
    fireEvent.timeUpdate(element)

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'Seeking' })).not.toBeInTheDocument()
    })
  })

  it('shows the full spinner when there is no frame to hold', () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'Preparing playback' })).toBeInTheDocument()
  })

  it('mutes and unmutes the media element itself', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()
    const element = screen.getByLabelText('Arrival')

    await actor.click(screen.getByRole('button', { name: 'Mute' }))

    expect(element).toHaveProperty('muted', true)

    await actor.click(screen.getByRole('button', { name: 'Unmute' }))

    expect(element).toHaveProperty('muted', false)
  })

  it('carries the volume through to the media element', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()

    screen.getByRole('slider', { name: 'Volume' }).focus()
    await actor.keyboard('{ArrowLeft}')

    expect(screen.getByLabelText('Arrival')).toHaveProperty('volume', 0.99)
  })

  it('asks for full screen on the whole stage, not just the video', async () => {
    const actor = userEvent.setup()
    const request = vi.fn()

    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: request,
    })

    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()
    await actor.click(screen.getByRole('button', { name: 'Full screen' }))

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('jumps back and forward without leaving the session when it can', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    const element = await screen.findByLabelText('Arrival')
    seekableTo(element, 600)
    Object.defineProperty(element, 'currentTime', { configurable: true, writable: true, value: 60 })
    fireEvent.timeUpdate(element)

    await actor.click(screen.getByRole('button', { name: 'Forward 10 seconds' }))

    expect(element).toHaveProperty('currentTime', 70)
    expect(startMock).toHaveBeenCalledTimes(1)
  })

  it('never jumps back past the start of the film', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    const element = await screen.findByLabelText('Arrival')
    seekableTo(element, 600)

    await actor.click(screen.getByRole('button', { name: 'Back 10 seconds' }))

    expect(element).toHaveProperty('currentTime', 0)
  })

  it('carries the chosen speed through to the media element', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await settled()
    await actor.click(screen.getByRole('button', { name: 'Playback speed' }))
    await actor.click(await screen.findByRole('menuitemradio', { name: '1.5x' }))

    expect(screen.getByLabelText('Arrival')).toHaveProperty('playbackRate', 1.5)
  })

  it('sets a display name so devtools can identify it', () => {
    expect(VideoPlayer.displayName).toBe('VideoPlayer')
  })
})
