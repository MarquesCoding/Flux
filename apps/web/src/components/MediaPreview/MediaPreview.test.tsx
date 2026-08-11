import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaPreview } from './MediaPreview'

const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9'

const play = vi.fn().mockResolvedValue(undefined)
const pause = vi.fn()

/**
 * The clip, which jsdom draws as an element and never plays.
 */
const videoOf = (): HTMLVideoElement => screen.getByLabelText('Preview')

/**
 * The still, which is the item's own artwork rather than a frame of the clip.
 */
const stillOf = (container: HTMLElement): HTMLElement | null => container.querySelector('img')

const isShowing = (element: Element | null): boolean =>
  element?.className.includes('opacity-100') === true

/**
 * Starts the clip the way the element itself would say it had.
 */
const startPlaying = async () => {
  await act(async () => {
    videoOf().dispatchEvent(new Event('play'))
    videoOf().dispatchEvent(new Event('playing'))
    await Promise.resolve()
  })
}

const endClip = async () => {
  await act(async () => {
    videoOf().dispatchEvent(new Event('ended'))
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  play.mockClear().mockResolvedValue(undefined)
  pause.mockClear()

  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause })
  // jsdom never plays anything, so its element would always report itself
  // paused and the pause button would read as a play button.
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get: () => false,
  })

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tracks: [] }) }),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(1500)
    await Promise.resolve()
  })
}

describe('MediaPreview', () => {
  it('opens on the artwork the item chose for itself', () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    )

    expect(stillOf(container)).toHaveAttribute('src', '/artwork.jpg')
    expect(isShowing(stillOf(container))).toBe(true)
  })

  it('falls back to a frame of the film for an item nothing has artwork for', () => {
    const { container } = render(
      <MediaPreview mediaId={MEDIA_ID} backdropUrl={null} durationSeconds={7200} />,
    )

    expect(stillOf(container)?.getAttribute('src')).toContain('/frame?')
  })

  it('waits before starting anything, since reading a runtime is not choosing to watch', () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={1200}
      />,
    )

    expect(play).not.toHaveBeenCalled()
  })

  it('starts the clip once somebody has stayed', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={1200}
      />,
    )

    await settle()

    expect(play).toHaveBeenCalled()
  })

  it('starts silent, whatever else it offers', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    )

    await settle()

    expect(videoOf().muted).toBe(true)
  })

  it('shows the clip once it is running', async () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    )

    await settle()
    await startPlaying()

    expect(isShowing(stillOf(container))).toBe(false)
  })

  it('does not put the still back over a clip that is only paused', async () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    )

    await settle()
    await startPlaying()

    await act(async () => {
      videoOf().dispatchEvent(new Event('pause'))
      await Promise.resolve()
    })

    expect(isShowing(stillOf(container))).toBe(false)
  })

  it('runs again rather than falling back, where nothing is waiting for it', async () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    )

    await settle()
    await startPlaying()
    await endClip()

    expect(isShowing(stillOf(container))).toBe(false)
  })

  it('goes back to the still when something is waiting for it', async () => {
    const onEnded = vi.fn()
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        onEnded={onEnded}
      />,
    )

    await settle()
    await startPlaying()
    await endClip()

    expect(isShowing(stillOf(container))).toBe(true)
  })

  it('says it has finished, so a hero changes on a still rather than mid-shot', async () => {
    const onEnded = vi.fn()

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        onEnded={onEnded}
      />,
    )

    await settle()
    await startPlaying()
    await endClip()

    expect(onEnded).toHaveBeenCalledOnce()
  })

  it('plays once when it is told to, even with nobody waiting', async () => {
    const { container } = render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        repeats={false}
      />,
    )

    await settle()
    await startPlaying()
    await endClip()

    expect(isShowing(stillOf(container))).toBe(true)
  })

  it('says when the picture starts moving, so what is over it can get out of the way', async () => {
    const onPlayingChange = vi.fn()

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        onPlayingChange={onPlayingChange}
      />,
    )

    await settle()
    await startPlaying()

    expect(onPlayingChange).toHaveBeenCalledWith(true)
  })

  it('offers no controls until there is something to control', () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    )

    expect(screen.queryByRole('button', { name: /sound/i })).not.toBeInTheDocument()
  })

  it('lets somebody stop a preview once it is running', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    )

    await settle()
    await startPlaying()
    await actor.click(screen.getByRole('button', { name: 'Pause the preview' }))

    expect(pause).toHaveBeenCalled()
  })

  it('lets somebody ask for sound', async () => {
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSound
      />,
    )

    await settle()
    await startPlaying()
    await actor.click(screen.getByRole('button', { name: 'Turn sound on' }))

    expect(videoOf().muted).toBe(false)
  })

  it('offers no sound where it was not asked to', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    )

    await settle()
    await startPlaying()

    expect(screen.queryByRole('button', { name: 'Turn sound on' })).not.toBeInTheDocument()
  })

  it('does not ask for subtitles it was not asked to show', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
      />,
    )

    await settle()

    await waitFor(() => {
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  it('asks what a viewer would be reading if they pressed play', async () => {
    render(
      <MediaPreview
        mediaId={MEDIA_ID}
        backdropUrl="/artwork.jpg"
        durationSeconds={7200}
        settleMilliseconds={0}
        hasSubtitles
      />,
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })
  })
})
