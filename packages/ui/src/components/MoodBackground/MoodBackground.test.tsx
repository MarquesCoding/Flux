import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MoodBackgroundModule from './MoodBackground'

const { MoodBackground } = MoodBackgroundModule

/**
 * The layer the wash is actually drawn on.
 *
 * Not the outer element: that one only holds a position, and the colour lives
 * inside it on a plain element, since the animation library's style type will
 * not carry a custom property.
 */
const wash = (container: HTMLElement): HTMLElement | null => container.querySelector('.flux-mood')

describe('MoodBackground', () => {
  it('lights the page from the colour it is given', () => {
    const { container } = render(<MoodBackground color="rgb(120, 40, 200)" />)

    expect(wash(container)?.style.getPropertyValue('--color-mood')).toBe('rgb(120, 40, 200)')
  })

  it('leaves the theme to decide when nothing is on screen yet', () => {
    const { container } = render(<MoodBackground color={null} />)

    expect(wash(container)?.getAttribute('style')).toBe(null)
  })

  it('ignores a colour that is not one', () => {
    const { container } = render(<MoodBackground color="" />)

    expect(wash(container)?.getAttribute('style')).toBe(null)
  })

  it('sets a display name so devtools can identify it', () => {
    expect(MoodBackground.displayName).toBe('MoodBackground')
  })
})
