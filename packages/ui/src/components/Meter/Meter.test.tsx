import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Meter } from './Meter'

const barOf = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[role="presentation"]')

describe('Meter', () => {
  it('names what is being measured', () => {
    render(<Meter label="Memory" fraction={0.5} value="8 GB" />)

    expect(screen.getByText('Memory')).toBeInTheDocument()
  })

  it('says the answer in words, which a bar alone cannot', () => {
    render(<Meter label="Memory" fraction={0.5} value="8 GB of 16 GB" />)

    expect(screen.getByText('8 GB of 16 GB')).toBeInTheDocument()
  })

  it('fills the bar to the fraction it was given', () => {
    const { container } = render(<Meter label="Memory" fraction={0.42} value="42%" />)

    expect(barOf(container)?.style.width).toBe('42%')
  })

  it('never fills past full, however far over the reading is', () => {
    const { container } = render(<Meter label="Memory" fraction={1.4} value="140%" />)

    expect(barOf(container)?.style.width).toBe('100%')
  })

  it('never fills below empty', () => {
    const { container } = render(<Meter label="Memory" fraction={-1} value="0%" />)

    expect(barOf(container)?.style.width).toBe('0%')
  })

  it('looks calm while something is idling', () => {
    const { container } = render(<Meter label="CPU" fraction={0.2} value="20%" />)

    expect(barOf(container)?.className).toContain('bg-accent')
  })

  it('warns as something approaches its limit', () => {
    const { container } = render(<Meter label="CPU" fraction={0.8} value="80%" />)

    expect(barOf(container)?.className).toContain('bg-amber-400')
  })

  it('looks different at a glance when something is at its limit', () => {
    const { container } = render(<Meter label="CPU" fraction={0.95} value="95%" />)

    expect(barOf(container)?.className).toContain('bg-danger')
  })
})
