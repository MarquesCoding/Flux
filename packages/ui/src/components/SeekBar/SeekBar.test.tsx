import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SeekBarModule from './SeekBar'

const { SeekBar } = SeekBarModule

const seekBar = (name = 'Seek') => screen.getByRole('slider', { name })

describe('SeekBar', () => {
  it('reports where in the media it is', () => {
    render(<SeekBar label="Seek" position={30} duration={120} onSeek={vi.fn()} />)

    expect(seekBar()).toHaveAttribute('aria-valuenow', '30')
    expect(seekBar()).toHaveAttribute('max', '120')
  })

  it('seeks from the keyboard, so scrubbing does not need a pointer', async () => {
    const onSeek = vi.fn()
    const user = userEvent.setup()
    render(<SeekBar label="Seek" position={30} duration={120} onSeek={onSeek} />)

    seekBar().focus()
    await user.keyboard('{ArrowRight}')

    expect(onSeek).toHaveBeenCalledWith(31)
  })

  it('cannot be dragged before the duration is known', () => {
    render(<SeekBar label="Seek" position={0} duration={0} onSeek={vi.fn()} />)

    expect(seekBar()).toBeDisabled()
  })

  it('draws no preview until the bar is hovered', () => {
    render(
      <SeekBar
        label="Seek"
        position={30}
        duration={120}
        onSeek={vi.fn()}
        renderPreview={(seconds) => <span>preview at {seconds}</span>}
      />,
    )

    expect(screen.queryByText(/preview at/)).not.toBeInTheDocument()
  })

  it('stops drawing a preview once the pointer leaves', async () => {
    const user = userEvent.setup()
    render(
      <SeekBar
        label="Seek"
        position={30}
        duration={120}
        onSeek={vi.fn()}
        renderPreview={(seconds) => <span>preview at {seconds}</span>}
      />,
    )

    await user.unhover(seekBar())

    expect(screen.queryByText(/preview at/)).not.toBeInTheDocument()
  })
})
