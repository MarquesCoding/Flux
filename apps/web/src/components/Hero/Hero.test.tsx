import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hero } from './Hero'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

vi.mock('@FluxWeb/components/MediaPreview/MediaPreview', () => ({
  MediaPreview: () => <div>preview</div>,
}))

const item = (id: string, title: string): MediaSummary => ({
  id,
  libraryId: 'library-1',
  title,
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: true,
})

const items = [item('a', 'Arrival'), item('b', 'Dune'), item('c', 'Sicario')]

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Hero', () => {
  it('shows nothing at all when there is nothing to feature', () => {
    const { container } = render(<Hero items={[]} onPlay={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('features the first item', () => {
    render(<Hero items={items} onPlay={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument()
  })

  it('names itself so the section can be found', () => {
    render(<Hero items={items} onPlay={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'Featured' })).toBeInTheDocument()
  })

  it('plays what is featured', async () => {
    const onPlay = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Hero items={items} onPlay={onPlay} />)

    await user.click(screen.getByRole('button', { name: /Play/ }))

    expect(onPlay).toHaveBeenCalledWith(items[0], 0)
  })

  it('carries on rather than starting again when there is somewhere to carry on from', async () => {
    const onPlay = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<Hero items={items} onPlay={onPlay} resumeFor={() => 620} />)

    await user.click(screen.getByRole('button', { name: /Resume/ }))

    expect(onPlay).toHaveBeenCalledWith(items[0], 620)
  })

  it('says which item is on screen, so the page can be lit by it', () => {
    const onFeatureChange = vi.fn()
    render(<Hero items={items} onPlay={vi.fn()} onFeatureChange={onFeatureChange} />)

    expect(onFeatureChange).toHaveBeenCalledWith(items[0])
  })

  it('moves on after a while', () => {
    render(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />)

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument()
  })

  it('comes back round to the beginning', async () => {
    render(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />)

    // One turn at a time: each rotation reschedules the next, and a single
    // long jump would fire the first timer and never see the ones it sets.
    for (let turn = 0; turn < items.length; turn += 1) {
      act(() => {
        vi.advanceTimersByTime(150)
      })
    }

    expect(await screen.findByRole('heading', { name: 'Arrival' })).toBeInTheDocument()
  })

  it('holds still while someone is reading it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />)

    await user.hover(screen.getByRole('region', { name: 'Featured' }))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument()
  })

  it('holds still while someone is tabbing through it', () => {
    render(<Hero items={items} onPlay={vi.fn()} rotateAfterMilliseconds={100} />)

    // Focusing and waiting have to be separate: the effect that cancels the
    // rotation only runs once React has flushed the focus, and doing both in
    // one go lets the timer fire first.
    act(() => {
      screen.getByRole('button', { name: /Play/ }).focus()
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument()
  })

  it('never rotates when there is only one thing to show', () => {
    render(
      <Hero
        items={[items[0] ?? item('a', 'Arrival')]}
        onPlay={vi.fn()}

        rotateAfterMilliseconds={100}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Show / })).not.toBeInTheDocument()
  })

  it('jumps straight to an item on request', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Hero items={items} onPlay={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Show Sicario' }))

    expect(await screen.findByRole('heading', { name: 'Sicario' })).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(Hero.displayName).toBe('Hero')
  })
})
