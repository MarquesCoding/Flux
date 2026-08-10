import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VideoSurfaceModule from './VideoSurface'

const { VideoSurface } = VideoSurfaceModule

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
})
