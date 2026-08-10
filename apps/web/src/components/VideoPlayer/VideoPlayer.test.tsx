import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VideoPlayerModule from './VideoPlayer'
import type { PlaybackPlan, Reason } from '@FluxContracts/schemas/PlaybackPlan'

const { VideoPlayer } = VideoPlayerModule

const startMock = vi.hoisted(() => vi.fn())
const stopMock = vi.hoisted(() => vi.fn())
const attachMock = vi.hoisted(() => vi.fn())
const teardownMock = vi.hoisted(() => vi.fn())

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

const media = { id: 'media-1', title: 'Arrival' }

const startedSession = {
  sessionId: 'abc',
  manifestUrl: '/api/playback/session/abc/index.m3u8',
  mode: 'Transcode',
  plan: transcodingPlan,
}

beforeEach(() => {
  startMock.mockReset()
  stopMock.mockReset()
  attachMock.mockReset()
  teardownMock.mockReset()

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
      expect(startMock).toHaveBeenCalledWith('media-1', { name: 'Browser' })
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

  it('shows the playback mode the server chose', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Transcode/ })).toBeInTheDocument()
  })

  it('explains why the stream is being converted, on request', async () => {
    const actor = userEvent.setup()
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await actor.click(await screen.findByRole('button', { name: /Transcode/ }))

    expect(screen.getByText('Video: Client does not support hevc')).toBeInTheDocument()
  })

  it('keeps the reasons hidden until asked', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await screen.findByRole('button', { name: /Transcode/ })

    expect(screen.queryByText('Video: Client does not support hevc')).not.toBeInTheDocument()
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

    expect(screen.getByRole('button', { name: /Play/ })).toBeDisabled()
  })

  it('shows a running position and duration', async () => {
    render(<VideoPlayer media={media} onClose={vi.fn()} />)

    await screen.findByLabelText('Arrival')

    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(VideoPlayer.displayName).toBe('VideoPlayer')
  })
})
