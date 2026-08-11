import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Rail } from './Rail'

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

  it('offers nowhere to go before anything overflows', () => {
    render(<Rail title="Recently added">{items}</Rail>)

    // One page is no pages: markers that cannot take you anywhere are marks on
    // a screen.
    expect(screen.queryByRole('button', { name: /Show page/ })).not.toBeInTheDocument()
  })

  it('offers a marker per screenful once there is more to see', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>)
    const track = container.querySelector('ul')

    if (track !== null) {
      overflowing(track, {})
      fireEvent.scroll(track)
    }

    // Three thousand across a thousand-wide window, turned eight hundred and
    // fifty at a time: the screenful showing and three more turns to reach the
    // end of it.
    expect(screen.getAllByRole('button', { name: /Show page/ })).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Show page 1' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('says which screenful is showing once it has moved', () => {
    const { container } = render(<Rail title="Recently added">{items}</Rail>)
    const track = container.querySelector('ul')

    if (track !== null) {
      overflowing(track, { scrollLeft: 850 })
      fireEvent.scroll(track)
    }

    expect(screen.getByRole('button', { name: 'Show page 2' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('leaves part of a card showing, so a viewer keeps their place', async () => {
    const user = userEvent.setup()
    const { container } = render(<Rail title="Recently added">{items}</Rail>)
    const track = container.querySelector('ul')
    const scrollTo = vi.fn()

    if (track !== null) {
      overflowing(track, {})
      track.scrollTo = scrollTo
      fireEvent.scroll(track)
    }

    await user.click(screen.getByRole('button', { name: 'Show page 2' }))

    expect(scrollTo).toHaveBeenCalledWith({ left: 850, behavior: 'smooth' })
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
