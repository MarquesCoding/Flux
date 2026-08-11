import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Slider } from './Slider'

const slider = (name = 'Seek') => screen.getByRole('slider', { name })

describe('Slider', () => {
  it('reports where in the media it is', () => {
    render(<Slider label="Seek" value={30} max={120} onValueChange={vi.fn()} />)

    expect(slider()).toHaveAttribute('aria-valuenow', '30')
    expect(slider()).toHaveAttribute('max', '120')
  })

  it('seeks from the keyboard, so scrubbing does not need a pointer', async () => {
    const onSeek = vi.fn()
    const user = userEvent.setup()
    render(<Slider label="Seek" value={30} max={120} onValueChange={onSeek} />)

    slider().focus()
    await user.keyboard('{ArrowRight}')

    expect(onSeek).toHaveBeenCalledWith(31)
  })

  it('cannot be dragged before the duration is known', () => {
    render(<Slider label="Seek" value={0} max={0} onValueChange={vi.fn()} />)

    expect(slider()).toBeDisabled()
  })

  it('draws no preview until the bar is hovered', () => {
    render(
      <Slider
        label="Seek"
        value={30}
        max={120}
        onValueChange={vi.fn()}
        renderPreview={(value) => <span>preview at {value}</span>}
      />,
    )

    expect(screen.queryByText(/preview at/)).not.toBeInTheDocument()
  })

  it('stops drawing a preview once the pointer leaves', async () => {
    const user = userEvent.setup()
    render(
      <Slider
        label="Seek"
        value={30}
        max={120}
        onValueChange={vi.fn()}
        renderPreview={(value) => <span>preview at {value}</span>}
      />,
    )

    await user.unhover(slider())

    expect(screen.queryByText(/preview at/)).not.toBeInTheDocument()
  })

  it('is drawn for a page by default', () => {
    const { container } = render(
      <Slider label="Seek" value={30} max={120} onValueChange={vi.fn()} />,
    )

    expect(container.querySelector('[data-tone="default"]')).toBeInTheDocument()
  })

  it('can be drawn for sitting on top of video, where theme surfaces vanish', () => {
    const { container } = render(
      <Slider label="Seek" value={30} max={120} tone="overlay" onValueChange={vi.fn()} />,
    )

    expect(container.querySelector('[data-tone="overlay"]')).toBeInTheDocument()
  })
})
