import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CheckboxModule from './Checkbox'

const { Checkbox } = CheckboxModule

describe('Checkbox', () => {
  it('renders an accessible checkbox named by its label', () => {
    render(<Checkbox label="Burn in subtitles" />)

    expect(screen.getByRole('checkbox', { name: 'Burn in subtitles' })).toBeInTheDocument()
  })

  it('reflects a default checked state', () => {
    render(<Checkbox label="Burn in subtitles" defaultChecked />)

    expect(screen.getByRole('checkbox', { name: 'Burn in subtitles' })).toBeChecked()
  })

  it('reports a change when toggled', async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Checkbox label="Burn in subtitles" onCheckedChange={onCheckedChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Burn in subtitles' }))

    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
  })

  it('does not report a change when disabled', async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(<Checkbox label="Burn in subtitles" disabled onCheckedChange={onCheckedChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Burn in subtitles' }))

    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(Checkbox.displayName).toBe('Checkbox')
  })
})
