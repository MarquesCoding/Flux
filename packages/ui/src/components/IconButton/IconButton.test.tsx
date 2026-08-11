import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconPlayerPlay } from '@tabler/icons-react'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('names itself for anyone who cannot see the icon', () => {
    render(
      <IconButton label="Play">
        <IconPlayerPlay aria-hidden />
      </IconButton>,
    )

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('reports being pressed when it is showing something', () => {
    render(
      <IconButton label="Stats for nerds" isActive>
        <IconPlayerPlay aria-hidden />
      </IconButton>,
    )

    expect(screen.getByRole('button', { name: 'Stats for nerds' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('acts when pressed', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <IconButton label="Play" onClick={onClick}>
        <IconPlayerPlay aria-hidden />
      </IconButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not act while disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <IconButton label="Play" disabled onClick={onClick}>
        <IconPlayerPlay aria-hidden />
      </IconButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(IconButton.displayName).toBe('IconButton')
  })
})
