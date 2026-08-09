import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SpinnerModule from './Spinner'

const { Spinner } = SpinnerModule

describe('Spinner', () => {
  it('exposes itself as a status region named by its label', () => {
    render(<Spinner label="Loading library" />)

    expect(screen.getByRole('status', { name: 'Loading library' })).toBeInTheDocument()
  })

  it('accepts a custom class', () => {
    render(<Spinner label="Loading" className="text-danger" />)

    expect(screen.getByRole('status', { name: 'Loading' })).toHaveClass('text-danger')
  })

  it('sets a display name so devtools can identify it', () => {
    expect(Spinner.displayName).toBe('Spinner')
  })
})
