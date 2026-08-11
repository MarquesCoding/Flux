import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoSurface } from './VideoSurface'

beforeEach(() => {
  // jsdom hands back a track list that cannot be listened to, and the surface
  // listens for cues arriving after the element already has its track.
  Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', {
    configurable: true,
    value: Object.assign([], { addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

describe('VideoSurface', () => {
  it('exposes the video element by its accessible name', () => {
    render(<VideoSurface label="Arrival" videoRef={createRef<HTMLVideoElement>()} />)

    expect(screen.getByLabelText('Arrival')).toBeInTheDocument()
  })

  it('hands the element to the playback engine through the ref', () => {
    const videoRef = createRef<HTMLVideoElement>()
    render(<VideoSurface label="Arrival" videoRef={videoRef} />)

    expect(videoRef.current).toBeInstanceOf(HTMLVideoElement)
  })

  it('does not use native controls, which cannot be themed', () => {
    render(<VideoSurface label="Arrival" videoRef={createRef<HTMLVideoElement>()} />)

    expect(screen.getByLabelText('Arrival')).not.toHaveAttribute('controls')
  })

  it('plays inline rather than taking over the screen', () => {
    render(<VideoSurface label="Arrival" videoRef={createRef<HTMLVideoElement>()} />)

    expect(screen.getByLabelText('Arrival')).toHaveAttribute('playsinline')
  })

  it('reports playback position', () => {
    const onTimeUpdate = vi.fn()
    render(
      <VideoSurface
        label="Arrival"
        videoRef={createRef<HTMLVideoElement>()}
        onTimeUpdate={onTimeUpdate}
      />,
    )

    fireEvent.timeUpdate(screen.getByLabelText('Arrival'))

    expect(onTimeUpdate).toHaveBeenCalled()
  })

  it('reports when playback starts and stops', () => {
    const onPlayingChange = vi.fn()
    render(
      <VideoSurface
        label="Arrival"
        videoRef={createRef<HTMLVideoElement>()}
        onPlayingChange={onPlayingChange}
      />,
    )

    fireEvent.play(screen.getByLabelText('Arrival'))
    fireEvent.pause(screen.getByLabelText('Arrival'))

    expect(onPlayingChange).toHaveBeenNthCalledWith(1, true)
    expect(onPlayingChange).toHaveBeenNthCalledWith(2, false)
  })

  it('accepts a poster image', () => {
    render(
      <VideoSurface
        label="Arrival"
        videoRef={createRef<HTMLVideoElement>()}
        poster="/poster.jpg"
      />,
    )

    expect(screen.getByLabelText('Arrival')).toHaveAttribute('poster', '/poster.jpg')
  })

  it('sets a display name so devtools can identify it', () => {
    expect(VideoSurface.displayName).toBe('VideoSurface')
  })

  it('shows no captions until a track is chosen', () => {
    const { container } = render(<VideoSurface label="Arrival" videoRef={{ current: null }} />)

    expect(container.querySelector('track')).not.toBeInTheDocument()
  })

  it('renders the chosen track for the browser to display itself', () => {
    const { container } = render(
      <VideoSurface
        label="Arrival"
        videoRef={{ current: null }}
        textTrack={{
          id: 'en',
          label: 'English',
          language: 'en',
          src: '/api/media/1/subtitles/en',
        }}
      />,
    )

    const track = container.querySelector('track')

    expect(track).toHaveAttribute('src', '/api/media/1/subtitles/en')
    expect(track).toHaveAttribute('srclang', 'en')
    expect(track).toHaveAttribute('label', 'English')
    expect(track).toHaveAttribute('kind', 'subtitles')
  })

  it('shows only one track at a time, so captions cannot stack', () => {
    const { container, rerender } = render(
      <VideoSurface
        label="Arrival"
        videoRef={{ current: null }}
        textTrack={{ id: 'en', label: 'English', language: 'en', src: '/en.vtt' }}
      />,
    )

    rerender(
      <VideoSurface
        label="Arrival"
        videoRef={{ current: null }}
        textTrack={{ id: 'fr', label: 'Français', language: 'fr', src: '/fr.vtt' }}
      />,
    )

    expect(container.querySelectorAll('track')).toHaveLength(1)
    expect(container.querySelector('track')).toHaveAttribute('src', '/fr.vtt')
  })
})
