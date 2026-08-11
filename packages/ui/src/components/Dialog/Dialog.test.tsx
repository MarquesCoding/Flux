import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

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

  it('arrives and leaves rather than appearing and vanishing', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    )

    // Driven by the state attributes the dialog sets on itself, because it
    // already holds the element mounted until the transition finishes —
    // anything animating it from outside would be racing that.
    const panel = screen.getByRole('dialog', { name: 'Arrival' })

    expect(panel.className).toContain('data-[starting-style]:opacity-0')
    expect(panel.className).toContain('data-[ending-style]:opacity-0')
  })

  it('rises from the edge a thumb summoned it from, and settles in place on a desktop', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    )

    const panel = screen.getByRole('dialog', { name: 'Arrival' })

    expect(panel.className).toContain('max-sm:data-[starting-style]:translate-y-10')
    expect(panel.className).toContain('sm:data-[starting-style]:scale-[0.92]')
  })

  it('drops the movement, but not the fade, when movement is unwelcome', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    )

    expect(screen.getByRole('dialog', { name: 'Arrival' }).className).toContain(
      'motion-reduce:transition-opacity',
    )
  })
  it('leaves faster than it arrives, since arriving is the part worth watching', () => {
    render(
      <Dialog label="Arrival" isOpen onClose={vi.fn()}>
        <p>Details</p>
      </Dialog>,
    )

    const panel = screen.getByRole('dialog', { name: 'Arrival' })

    expect(panel.className).toContain('duration-[280ms]')
    expect(panel.className).toContain('data-[ending-style]:duration-150')
  })
})
