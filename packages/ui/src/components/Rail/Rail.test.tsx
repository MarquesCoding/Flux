import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import RailModule from './Rail'

const { Rail } = RailModule

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {
        return undefined
      }

      disconnect() {
        return undefined
      }
    },
  )
})

/**
 * jsdom lays nothing out, so how much a row overflows has to be described.
 */
const overflowing = (element: HTMLElement, options: { scrollLeft?: number }) => {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: 3000 })
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: 1000 })
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: options.scrollLeft ?? 0,
  })
}

const items = ['One', 'Two', 'Three'].map((name) => <li key={name}>{name}</li>)

describe('Rail', () => {
  it('names itself so the row can be found', () => {
    render(<Rail title="Recently added">{items}</Rail>)

    expect(screen.getByRole('region', { name: 'Recently added' })).toBeInTheDocument()
  })

  it('shows what it was given', () => {
    render(<Rail title="Recently added">{items}</Rail>)

    expect(screen.getByText('Two')).toBeInTheDocument()
  })

  it('offers nowhere to scroll before anything overflows', () => {
    render(<Rail title="Recently added">{items}</Rail>)

    expect(screen.getByRole('button', { name: 'Scroll Recently added left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Scroll Recently added right' })).toBeDisabled()
  })

  it('offers to scroll on once there is more to see', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>)
    const track = container.querySelector('ul')

    if (track !== null) {
      overflowing(track, {})
      fireEvent.scroll(track)
    }

    expect(screen.getByRole('button', { name: 'Scroll Recently added right' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Scroll Recently added left' })).toBeDisabled()
  })

  it('offers to scroll back once it has moved', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>)
    const track = container.querySelector('ul')

    if (track !== null) {
      overflowing(track, { scrollLeft: 500 })
      fireEvent.scroll(track)
    }

    expect(screen.getByRole('button', { name: 'Scroll Recently added left' })).toBeEnabled()
  })

  it('leaves part of a card showing, so a viewer keeps their place', async () => {
    const user = userEvent.setup()
    const { container } = render(<Rail title="Recently added">{items}</Rail>)
    const track = container.querySelector('ul')
    const scrollBy = vi.fn()

    if (track !== null) {
      overflowing(track, {})
      track.scrollBy = scrollBy
      fireEvent.scroll(track)
    }

    await user.click(screen.getByRole('button', { name: 'Scroll Recently added right' }))

    expect(scrollBy).toHaveBeenCalledWith({ left: 850, behavior: 'smooth' })
  })

  it('shows an action beside the heading when one is given', () => {
    render(
      <Rail title="Recently added" action={<span>See all</span>}>
        {items}
      </Rail>,
    )

    expect(screen.getByText('See all')).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(Rail.displayName).toBe('Rail')
  })
})
