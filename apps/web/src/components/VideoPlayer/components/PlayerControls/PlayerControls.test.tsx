import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PlayerControlsModule from './PlayerControls'
import type { PlayerControlsProps } from './PlayerControls.types'

const { PlayerControls } = PlayerControlsModule

const draw = (overrides: Partial<PlayerControlsProps> = {}) => {
  const props: PlayerControlsProps = {
    title: 'Arrival',
    isPlaying: false,
    position: 30,
    duration: 7200,
    volume: 1,
    isMuted: false,
    isFullscreen: false,
    isShowingStats: false,
    onTogglePlay: vi.fn(),
    onSeek: vi.fn(),
    onVolumeChange: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onToggleStats: vi.fn(),
    ...overrides,
  }

  render(<PlayerControls {...props} />)

  return props
}

describe('PlayerControls', () => {
  it('offers play while paused', () => {
    draw()

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('offers pause while playing', () => {
    draw({ isPlaying: true })

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('reports a press of play', async () => {
    const user = userEvent.setup()
    const props = draw()

    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(props.onTogglePlay).toHaveBeenCalledTimes(1)
  })

  it('shows the position against the length', () => {
    draw()

    expect(screen.getByText('0:30')).toBeInTheDocument()
    expect(screen.getByText('/ 2:00:00')).toBeInTheDocument()
  })

  it('names the scrub bar after what is playing', () => {
    draw()

    expect(screen.getByRole('slider', { name: 'Seek through Arrival' })).toBeInTheDocument()
  })

  it('reports a seek', async () => {
    const user = userEvent.setup()
    const props = draw()

    screen.getByRole('slider', { name: 'Seek through Arrival' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(props.onSeek).toHaveBeenCalledWith(31)
  })

  it('shows volume as a percentage of the way up', () => {
    draw({ volume: 0.5 })

    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '50')
  })

  it('reports volume back as a fraction, not a percentage', async () => {
    const user = userEvent.setup()
    const props = draw({ volume: 0.5 })

    screen.getByRole('slider', { name: 'Volume' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(props.onVolumeChange).toHaveBeenCalledWith(0.51)
  })

  it('shows a muted icon and a bar at zero while muted', () => {
    draw({ isMuted: true, volume: 1 })

    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('shows a muted icon when the volume is simply down', () => {
    draw({ volume: 0 })

    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument()
  })

  it('reports that stats are showing', () => {
    draw({ isShowingStats: true })

    expect(screen.getByRole('button', { name: 'Stats for nerds' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('offers to leave full screen once in it', () => {
    draw({ isFullscreen: true })

    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument()
  })

  it('cannot be played before there is anything to play', () => {
    draw({ isDisabled: true })

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  })

  it('draws a preview when the caller supplies one', () => {
    draw({ renderPreview: () => <span>a thumbnail</span> })

    expect(screen.queryByText('a thumbnail')).not.toBeInTheDocument()
  })

  it('draws its sliders for sitting on top of video', () => {
    const { container } = render(
      <PlayerControls
        title="Arrival"
        isPlaying={false}
        position={30}
        duration={7200}
        volume={1}
        isMuted={false}
        isFullscreen={false}
        isShowingStats={false}
        onTogglePlay={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onToggleMute={vi.fn()}
        onToggleFullscreen={vi.fn()}
        onToggleStats={vi.fn()}
      />,
    )

    // Theme surface colours are near black, which is invisible on a dark bar
    // over a dark picture.
    expect(container.querySelectorAll('[data-tone="overlay"]')).toHaveLength(2)
    expect(container.querySelector('[data-tone="default"]')).not.toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(PlayerControls.displayName).toBe('PlayerControls')
  })
})
