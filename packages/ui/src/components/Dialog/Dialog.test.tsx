import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DialogModule from './Dialog'

const { Dialog } = DialogModule

describe('Dialog', () => {
  it('shows nothing while closed', () => {
    render(
      <Dialog label="Arrival" isOpen={false} onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    )

    expect(screen.queryByText('Details')).not.toBeInTheDocument()
  })

  it('names itself so it can be found', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    )

    expect(screen.getByRole('dialog', { name: 'Arrival' })).toBeInTheDocument()
  })

  it('closes on escape, which is what everyone tries first', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Dialog label="Arrival" isOpen onClose={onClose}>
        <p>Details</p>
      </Dialog>,
    )

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(Dialog.displayName).toBe('Dialog')
  })
})
