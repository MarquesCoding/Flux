import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CaptionChoice } from './CaptionChoice'

const options = [
  { id: 'sans', label: 'Sans serif' },
  { id: 'serif', label: 'Serif' },
]

describe('CaptionChoice', () => {
  it('names the decision it is asking about', () => {
    render(<CaptionChoice label="Font" options={options} selectedId="sans" onSelect={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Font' })).toBeInTheDocument()
  })

  it('lays every choice out rather than hiding them behind a menu', () => {
    render(<CaptionChoice label="Font" options={options} selectedId="sans" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Sans serif' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Serif' })).toBeInTheDocument()
  })

  it('says which one is in force rather than only looking it', () => {
    render(<CaptionChoice label="Font" options={options} selectedId="serif" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Serif' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sans serif' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports a change', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(<CaptionChoice label="Font" options={options} selectedId="sans" onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Serif' }))

    expect(onSelect).toHaveBeenCalledWith('serif')
  })

  it('sets a display name so devtools can identify it', () => {
    expect(CaptionChoice.displayName).toBe('CaptionChoice')
  })
})
