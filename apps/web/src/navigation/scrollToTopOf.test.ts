import { describe, expect, it, vi } from 'vitest'
import { scrollToTopOf } from './scrollToTopOf'

/**
 * jsdom lays nothing out, so a panel that scrolls has to be described.
 */
const scroller = (isOverflowing: boolean) => {
  const holder = document.createElement('div')
  const scrollTo = vi.fn()

  holder.style.overflowY = 'auto'
  Object.defineProperty(holder, 'scrollHeight', {
    configurable: true,
    value: isOverflowing ? 900 : 100,
  })
  Object.defineProperty(holder, 'clientHeight', { configurable: true, value: 100 })
  Object.defineProperty(holder, 'scrollTo', { configurable: true, value: scrollTo })

  const inside = document.createElement('div')

  holder.append(inside)
  document.body.append(holder)

  return { holder, inside, scrollTo }
}

describe('scrollToTopOf', () => {
  it('takes the panel around an element back to its beginning', () => {
    const { inside, scrollTo } = scroller(true)

    scrollToTopOf(inside)

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('jumps where somebody has asked for nothing to move', () => {
    const { inside, scrollTo } = scroller(true)

    scrollToTopOf(inside, false)

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('passes over a container that is not scrolling anything', () => {
    const { inside, scrollTo } = scroller(false)
    const windowScroll = vi.fn()

    vi.stubGlobal('scrollTo', windowScroll)
    scrollToTopOf(inside)

    expect(scrollTo).not.toHaveBeenCalled()
    expect(windowScroll).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    vi.unstubAllGlobals()
  })

  it('does nothing where there is nothing to scroll from', () => {
    const windowScroll = vi.fn()

    vi.stubGlobal('scrollTo', windowScroll)
    scrollToTopOf(null)

    expect(windowScroll).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
