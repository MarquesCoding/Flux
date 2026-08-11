import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ScanProgressBarModule from './ScanProgressBar'

const { ScanProgressBar } = ScanProgressBarModule

describe('ScanProgressBar', () => {
  it('says what is being scanned', () => {
    render(<ScanProgressBar label="Scanning Movies" processed={4} total={10} />)

    expect(screen.getByRole('progressbar', { name: 'Scanning Movies' })).toBeInTheDocument()
  })

  it('reports how far through a scan with a known total actually is', () => {
    render(<ScanProgressBar label="Scanning Movies" processed={4} total={10} />)

    const bar = screen.getByRole('progressbar', { name: 'Scanning Movies' })

    expect(bar).toHaveAttribute('aria-valuenow', '4')
    expect(bar).toHaveAttribute('aria-valuemax', '10')
    expect(screen.getByText('4/10')).toBeInTheDocument()
  })

  it('has no numeric value before the walk has counted its files', () => {
    render(<ScanProgressBar label="Scanning Movies" processed={null} total={null} />)

    const bar = screen.getByRole('progressbar', { name: 'Scanning Movies' })

    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(screen.queryByText(/\//)).not.toBeInTheDocument()
  })
})
