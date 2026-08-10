import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MediaCardModule from './MediaCard'

const { MediaCard } = MediaCardModule

describe('MediaCard', () => {
  it('is a single button covering the whole tile', async () => {
    const onSelect = vi.fn()
    const actor = userEvent.setup()
    render(<MediaCard title="Arrival" subtitle="2016" onSelect={onSelect} />)

    await actor.click(screen.getByRole('button', { name: /Arrival/ }))

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('can be activated from the keyboard', async () => {
    const onSelect = vi.fn()
    const actor = userEvent.setup()
    render(<MediaCard title="Arrival" subtitle="2016" onSelect={onSelect} />)

    await actor.tab()
    await actor.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('shows the title and subtitle', () => {
    render(<MediaCard title="Arrival" subtitle="2016 · 1:56" onSelect={vi.fn()} />)

    expect(screen.getByText('Arrival')).toBeInTheDocument()
    expect(screen.getByText('2016 · 1:56')).toBeInTheDocument()
  })

  it('shows badges when given them', () => {
    render(
      <MediaCard title="Arrival" subtitle="2016" badges={['4K', 'HDR10']} onSelect={vi.fn()} />,
    )

    expect(screen.getByText('4K')).toBeInTheDocument()
    expect(screen.getByText('HDR10')).toBeInTheDocument()
  })

  it('falls back to the first letter when there is no artwork', () => {
    render(<MediaCard title="arrival" subtitle="2016" onSelect={vi.fn()} />)

    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('shows artwork when it exists', () => {
    render(<MediaCard title="Arrival" subtitle="2016" imageUrl="/poster.jpg" onSelect={vi.fn()} />)

    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute('src', '/poster.jpg')
  })

  it('does not announce the poster twice', () => {
    render(<MediaCard title="Arrival" subtitle="2016" imageUrl="/poster.jpg" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Arrival 2016' })).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(MediaCard.displayName).toBe('MediaCard')
  })
})
