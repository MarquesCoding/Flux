import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ScanProgressBarModule from './ScanProgressBar'

const { ScanProgressBar } = ScanProgressBarModule

describe('ScanProgressBar', () => {
  it('says what is being scanned', () => {
    render(<ScanProgressBar label="Scanning Movies" />)

    expect(screen.getByRole('progressbar', { name: 'Scanning Movies' })).toBeInTheDocument()
  })
})
