import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MoodBackgroundModule from './MoodBackground'

const { MoodBackground } = MoodBackgroundModule

describe('MoodBackground', () => {
  it('lights the page from the colour it is given', () => {
    render(<MoodBackground color="rgb(120, 40, 200)" />)

    expect(screen.getByRole('presentation')).toHaveStyle({ '--color-mood': 'rgb(120, 40, 200)' })
  })

  it('leaves the theme to decide when nothing is on screen yet', () => {
    render(<MoodBackground color={null} />)

    expect(screen.getByRole('presentation').getAttribute('style')).toBe(null)
  })

  it('ignores a colour that is not one', () => {
    render(<MoodBackground color="" />)

    expect(screen.getByRole('presentation').getAttribute('style')).toBe(null)
  })

  it('sets a display name so devtools can identify it', () => {
    expect(MoodBackground.displayName).toBe('MoodBackground')
  })
})
