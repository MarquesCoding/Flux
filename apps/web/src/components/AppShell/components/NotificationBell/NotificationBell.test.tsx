import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NotificationBell } from './NotificationBell'

describe('NotificationBell', () => {
  it('offers a way to look, whether or not anything has happened', () => {
    render(<NotificationBell />)

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('says plainly that nothing has happened rather than saying nothing', async () => {
    const user = userEvent.setup()

    render(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: 'Notifications' }))

    expect(await screen.findByText('Nothing new.')).toBeInTheDocument()
  })

  it('says what would turn up here', async () => {
    const user = userEvent.setup()

    render(<NotificationBell />)
    await user.click(screen.getByRole('button', { name: 'Notifications' }))

    expect(await screen.findByText(/Finished scans/)).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(NotificationBell.displayName).toBe('NotificationBell')
  })
})
