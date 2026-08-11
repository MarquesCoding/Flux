import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdminMessageOverlayModule from './AdminMessageOverlay'

const { AdminMessageOverlay } = AdminMessageOverlayModule

describe('AdminMessageOverlay', () => {
  it('shows why the stream stopped', () => {
    render(
      <AdminMessageOverlay
        kind="stopped"
        reason="This stream was stopped by an admin."
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText('This stream was stopped by an admin.')).toBeInTheDocument()
  })

  it('calls onDismiss when closed after a stop', async () => {
    const onDismiss = vi.fn()

    render(<AdminMessageOverlay kind="stopped" reason="Stopped." onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onDismiss).toHaveBeenCalled()
  })

  it('shows why the stream was paused', () => {
    render(
      <AdminMessageOverlay
        kind="paused"
        reason="This stream was paused by an admin."
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText('This stream was paused by an admin.')).toBeInTheDocument()
  })

  it('calls onDismiss when the pause banner is dismissed', async () => {
    const onDismiss = vi.fn()

    render(<AdminMessageOverlay kind="paused" reason="Paused." onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalled()
  })
})
