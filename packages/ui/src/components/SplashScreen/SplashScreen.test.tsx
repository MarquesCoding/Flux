import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SplashScreenModule from './SplashScreen'

const { SplashScreen } = SplashScreenModule

describe('SplashScreen', () => {
  it('says something is happening, for anyone who cannot see the bar', () => {
    render(<SplashScreen />)

    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the name of the instance', () => {
    render(<SplashScreen name="Living Room" />)

    expect(screen.getByText('Living Room')).toBeInTheDocument()
  })

  it('says what is being waited for when it is worth naming', () => {
    render(<SplashScreen label="Preparing your library" />)

    expect(screen.getByRole('status', { name: 'Preparing your library' })).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(SplashScreen.displayName).toBe('SplashScreen')
  })
})
